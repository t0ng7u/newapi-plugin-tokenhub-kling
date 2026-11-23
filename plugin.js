// Kling video generation on Tencent Cloud TokenHub for Task Plugin channels:
//   POST {base}/v1/wand/kling/{text-to-video|image-to-video|omni-video|motion-control}
//   GET  {base}/v1/wand/kling/tasks/{id}
// The channel key is a TokenHub API key, sent as a Bearer token. Type-60 New API
// channels address this plugin's own /t0ng7u_tokenhub-kling routes on that gateway.
//
// TokenHub bills every Kling model in tokens at one unit price and reports the
// tokens a finished task consumed in tokenhub_usage.total_tokens, which settles
// the task. Submission reserves the tokens of the published per-second rates
// (cloud.tencent.com/document/product/1823/130055).

const HD = ["720p", "1080p"];
const UHD = ["720p", "1080p", "4k"];
const RATIOS = ["16:9", "9:16", "1:1"];
const V4_RATIOS = ["21:9", "16:9", "9:16", "1:1"];
const NATIVE_AUDIO = ["native", "off"];
const ORIGINAL_AUDIO = ["original", "off"];
const NATIVE_ORIGINAL_AUDIO = ["native", "original"];

function integers(min, max) {
  const values = [];
  for (let value = min; value <= max; value++) values.push(value);
  return values;
}

// Per model: the endpoints it serves with the settings each takes, its
// resolutions and durations, and its tokens per billed second keyed by variant
// and resolution. Motion control has no duration: the output follows the
// motion reference video. kling-video-v3-turbo is listed at a single rate.
// v4 and v4-flash produce 10 seconds when no duration is given, the others 5.
const MODELS = {
  "kling-video-v4-flash": {
    endpoints: {
      "text-to-video": { aspectRatios: V4_RATIOS },
      "image-to-video": {},
      "omni-video": { aspectRatios: V4_RATIOS.concat(["adaptive"]), audio: NATIVE_ORIGINAL_AUDIO },
    },
    resolutions: ["720p"],
    durations: integers(3, 20),
    defaultSeconds: 10,
    // Billed like v4 with an input video. TokenHub publishes no input length
    // limit of its own for v4-flash, so v4's 30 seconds bounds the reservation.
    inputVideoSeconds: 30,
    rates: { silent: { "720p": 100000 }, reference: { "720p": 60000 } },
  },
  "kling-video-v4": {
    endpoints: {
      "text-to-video": { aspectRatios: V4_RATIOS },
      "image-to-video": {},
      "omni-video": { aspectRatios: V4_RATIOS.concat(["adaptive"]), audio: NATIVE_ORIGINAL_AUDIO },
    },
    resolutions: HD,
    defaultResolution: "1080p",
    durations: integers(3, 30),
    defaultSeconds: 10,
    // With an input video v4 bills max(output × 2, input + output) seconds,
    // and its input videos total at most 30 seconds.
    inputVideoSeconds: 30,
    rates: { silent: { "720p": 100000, "1080p": 150000 }, reference: { "720p": 60000, "1080p": 90000 } },
  },
  "kling-video-v3": {
    endpoints: {
      "text-to-video": { aspectRatios: RATIOS, audio: NATIVE_AUDIO, multiShot: true },
      "image-to-video": { audio: NATIVE_AUDIO, multiShot: true },
    },
    resolutions: UHD,
    durations: integers(3, 15),
    rates: { silent: { "720p": 60000, "1080p": 80000, "4k": 300000 }, audio: { "720p": 90000, "1080p": 120000, "4k": 300000 } },
  },
  "kling-video-v3-turbo": {
    endpoints: { "text-to-video": { aspectRatios: RATIOS }, "image-to-video": {} },
    resolutions: HD,
    durations: integers(3, 15),
    rates: { silent: { "720p": 80000, "1080p": 100000 } },
  },
  "kling-video-v3-omni": {
    endpoints: { "omni-video": { aspectRatios: RATIOS, aspectRatioRequired: true, audio: ["native", "original", "off"], multiShot: true } },
    resolutions: UHD,
    durations: integers(3, 15),
    rates: {
      silent: { "720p": 60000, "1080p": 80000, "4k": 300000 },
      audio: { "720p": 80000, "1080p": 100000, "4k": 300000 },
      reference: { "720p": 90000, "1080p": 120000, "4k": 300000 },
    },
  },
  "kling-video-o1": {
    endpoints: { "omni-video": { aspectRatios: RATIOS, aspectRatioRequired: true, audio: ORIGINAL_AUDIO } },
    resolutions: HD,
    durations: integers(3, 10),
    rates: { silent: { "720p": 60000, "1080p": 80000 }, reference: { "720p": 90000, "1080p": 120000 } },
  },
  "kling-video-v2.6": {
    endpoints: { "text-to-video": { aspectRatios: RATIOS, audio: NATIVE_AUDIO }, "image-to-video": { audio: NATIVE_AUDIO } },
    resolutions: HD,
    durations: [5, 10],
    rates: { silent: { "720p": 30000, "1080p": 50000 }, audio: { "1080p": 100000 }, voice: { "1080p": 120000 } },
  },
  "kling-video-v2.5-turbo": {
    endpoints: { "text-to-video": { aspectRatios: RATIOS }, "image-to-video": {} },
    resolutions: HD,
    durations: [5, 10],
    rates: { silent: { "720p": 30000, "1080p": 50000 } },
  },
  "kling-video-motion-control-v3.0": {
    endpoints: { "motion-control": { audio: ORIGINAL_AUDIO, orientations: ["image", "video"] } },
    resolutions: HD,
    rates: { silent: { "720p": 90000, "1080p": 120000 } },
  },
  "kling-video-motion-control-v2.6": {
    endpoints: { "motion-control": { audio: ORIGINAL_AUDIO, orientations: ["image", "video"] } },
    resolutions: HD,
    rates: { silent: { "720p": 50000, "1080p": 80000 } },
  },
};

// The members of each content item type; the first one is required.
const CONTENT_MEMBERS = {
  prompt: ["text"],
  first_frame: ["url"],
  middle_frame: ["url"],
  last_frame: ["url"],
  refer_image: ["url"],
  feature_video: ["url"],
  base_video: ["url"],
  image: ["url"],
  video: ["url"],
  element: ["element_id", "id"],
  voice: ["voice_id", "id"],
};
const CONTENT_TYPES = {
  "image-to-video": ["prompt", "first_frame", "middle_frame", "last_frame", "element", "voice"],
  "omni-video": ["prompt", "first_frame", "middle_frame", "last_frame", "refer_image", "feature_video", "base_video", "element", "voice"],
  "motion-control": ["prompt", "image", "video", "element"],
};
// Whether an element is a video character is not in the request, so an omni
// element is reserved as an input video; the reported tokens settle the task.
const VIDEO_INPUT_TYPES = ["feature_video", "base_video", "element"];

const DEFAULT_RESOLUTION = "720p";
const DEFAULT_SECONDS = 5;
// A video edit (base_video) is as long as its input, at most 15.5 seconds,
// billed rounded to whole seconds.
const EDIT_MAX_SECONDS = 16;
// The longest motion reference video for each character orientation.
const MOTION_MAX_SECONDS = { image: 10, video: 30 };
const RESOLUTION_SIDES = { "720p": 720, "1080p": 1080, "4k": 2160 };
// A multipart input_reference is sent inline as a data URL; TokenHub takes
// images of at most 50 MB (30 MB on v4, which it checks itself).
const MAX_UPLOAD_BYTES = 52428800;

const ACTIONS = {
  "text-to-video": "text_to_video",
  "image-to-video": "image_to_video",
  "omni-video": "reference_to_video",
  "motion-control": "motion_control",
};
const STATUSES = { submitted: "SUBMITTED", processing: "IN_PROGRESS", succeeded: "SUCCESS", failed: "FAILURE" };
const VIDEO_STATUSES = { NOT_START: "queued", SUBMITTED: "queued", QUEUED: "queued", IN_PROGRESS: "in_progress", SUCCESS: "completed", FAILURE: "failed" };
// TokenHub's business codes for the statuses the gateway answers with.
const ERROR_CODES = { 400: 1200, 401: 1000, 403: 1103, 404: 1203, 429: 1302, 500: 5000, 503: 5001, 504: 5002 };

export const meta = {
  apiVersion: 1,
  key: "t0ng7u_tokenhub-kling",
  name: { en: "TokenHub Kling", zh: "TokenHub 可灵" },
  icon: "Kling.Color",
  description: {
    en: "Kling video from text, images, references or motion via Tencent Cloud TokenHub",
    zh: "通过腾讯云 TokenHub 调用可灵文生视频、图生视频、全能视频与动作控制",
  },
  version: "1.0.0",
  author: { name: "t0ng7u", url: "https://github.com/t0ng7u" },
  baseUrl: "https://tokenhub.tencentmaas.com",
  auth: "api_key",
  // Model lists are literals so the console can preview them without running
  // the plugin; they mirror the endpoints of MODELS.
  models: [
    "kling-video-v4-flash",
    "kling-video-v4",
    "kling-video-v3",
    "kling-video-v3-turbo",
    "kling-video-v3-omni",
    "kling-video-o1",
    "kling-video-v2.6",
    "kling-video-v2.5-turbo",
    "kling-video-motion-control-v3.0",
    "kling-video-motion-control-v2.6",
  ],
  fetchMode: "per_task",
  upstreams: ["vendor", "new_api"],
  usageSchema: {
    // TokenHub tokens: the published rates at submission, tokenhub_usage.total_tokens on completion.
    tokens: { type: "number", unit: "token", description: { en: "Video generation unit price", zh: "视频生成单价" } },
  },
  usageExamples: [
    { label: "v2.5 turbo · 720p · 5s", facts: { tokens: 150000 } },
    { label: "v3 · 1080p · 5s", facts: { tokens: 400000 } },
    { label: "v3 · 1080p · 5s · audio", facts: { tokens: 600000 } },
    { label: "v3 · 4k · 5s", facts: { tokens: 1500000 } },
    { label: "v4 flash · 720p · 10s", facts: { tokens: 1000000 } },
    { label: "v4 · 1080p · 10s", facts: { tokens: 1500000 } },
    { label: "v4 · 1080p · 10s · 10s reference video", facts: { tokens: 1800000 } },
    { label: "motion control v3.0 · 1080p · 10s", facts: { tokens: 1200000 } },
  ],
  routes: [
    {
      method: "POST",
      path: "/v1/wand/kling/text-to-video",
      type: "submit",
      action: "text_to_video",
      models: ["kling-video-v4-flash", "kling-video-v4", "kling-video-v3", "kling-video-v3-turbo", "kling-video-v2.6", "kling-video-v2.5-turbo"],
      decode: "textToVideo",
      render: "taskCreated",
    },
    {
      method: "POST",
      path: "/v1/wand/kling/image-to-video",
      type: "submit",
      action: "image_to_video",
      models: ["kling-video-v4-flash", "kling-video-v4", "kling-video-v3", "kling-video-v3-turbo", "kling-video-v2.6", "kling-video-v2.5-turbo"],
      decode: "imageToVideo",
      render: "taskCreated",
    },
    {
      method: "POST",
      path: "/v1/wand/kling/omni-video",
      type: "submit",
      action: "reference_to_video",
      models: ["kling-video-v4-flash", "kling-video-v4", "kling-video-v3-omni", "kling-video-o1"],
      decode: "omniVideo",
      render: "taskCreated",
    },
    {
      method: "POST",
      path: "/v1/wand/kling/motion-control",
      type: "submit",
      action: "motion_control",
      models: ["kling-video-motion-control-v3.0", "kling-video-motion-control-v2.6"],
      decode: "motionControl",
      render: "taskCreated",
    },
    { method: "GET", path: "/v1/wand/kling/tasks/:task_id", type: "query", render: "taskStatus" },
  ],
  protocols: [
    {
      name: "openai_responses",
      supports: ["stream", "sync", "background"],
      models: [
        "kling-video-v4-flash",
        "kling-video-v4",
        "kling-video-v3",
        "kling-video-v3-turbo",
        "kling-video-v3-omni",
        "kling-video-o1",
        "kling-video-v2.6",
        "kling-video-v2.5-turbo",
      ],
    },
    {
      name: "openai_video",
      models: [
        "kling-video-v4-flash",
        "kling-video-v4",
        "kling-video-v3",
        "kling-video-v3-turbo",
        "kling-video-v3-omni",
        "kling-video-o1",
        "kling-video-v2.6",
        "kling-video-v2.5-turbo",
      ],
    },
  ],
};

function trimmed(value) {
  return String(value || "").trim();
}

function isObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function objectOrEmpty(value) {
  return isObject(value) ? value : {};
}

// Own-property lookup so request-controlled keys never reach the prototype.
function lookup(table, key) {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined;
}

function rejectUnknownKeys(object, allowed, label) {
  for (const key of Object.keys(object)) {
    if (!allowed.includes(key)) throw new Error(label + key + " is not supported");
  }
}

function hasContent(contents, types) {
  return contents.some(function (item) {
    return types.includes(item.type);
  });
}

function jsonObjectBody(ctx) {
  if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
  if (!isObject(ctx.body.value)) throw new Error("request body must be an object");
  return ctx.body.value;
}

function apiRoot(ctx) {
  return ctx.baseUrl + (ctx.upstream && ctx.upstream.kind === "new_api" ? "/t0ng7u_tokenhub-kling" : "") + "/v1/wand/kling";
}

function requestHeaders(ctx) {
  const apiKey = trimmed(ctx.apiKey);
  if (!apiKey) throw new Error("api_key is empty");
  return { Accept: "application/json", Authorization: "Bearer " + apiKey };
}

// Only the host protocols put a file placeholder in a url: the multipart
// upload of openai_video, as the first frame.
function validContents(endpoint, value, upload) {
  if (!Array.isArray(value) || !value.length) throw new Error("contents must be a non-empty array");
  const types = CONTENT_TYPES[endpoint];
  return value.map(function (item, index) {
    const label = "contents[" + index + "].";
    if (!isObject(item)) throw new Error("contents[" + index + "] must be an object");
    if (!types.includes(item.type)) throw new Error(label + "type must be one of: " + types.join(", "));
    const members = CONTENT_MEMBERS[item.type];
    rejectUnknownKeys(item, ["type"].concat(members), label);
    const content = { type: item.type };
    members.forEach(function (member, position) {
      const field = item[member];
      if (field === undefined && position > 0) return;
      if (upload && isObject(field) && field.__fileRef === upload.__fileRef) content[member] = upload;
      else if (typeof field === "string" && field.trim()) content[member] = field;
      else throw new Error(label + member + " must be a non-empty string");
    });
    return content;
  });
}

function validSettings(spec, route, endpoint, value) {
  if (value !== undefined && !isObject(value)) throw new Error("settings must be an object");
  const settings = objectOrEmpty(value);
  const allowed = ["resolution"];
  if (spec.durations) allowed.push("duration");
  if (route.aspectRatios) allowed.push("aspect_ratio");
  if (route.audio) allowed.push("audio");
  if (route.multiShot) allowed.push("multi_shot");
  if (route.orientations) allowed.push("character_orientation");
  rejectUnknownKeys(settings, allowed, "settings.");

  const valid = {};
  if (settings.resolution !== undefined) {
    valid.resolution = trimmed(settings.resolution).toLowerCase();
    if (!spec.resolutions.includes(valid.resolution)) throw new Error("settings.resolution must be one of: " + spec.resolutions.join(", "));
  }
  // A billed quantity: only the model's own durations pass.
  if (settings.duration !== undefined) {
    if (!spec.durations.includes(settings.duration)) {
      const range = spec.durations.length > 2 ? spec.durations[0] + " to " + spec.durations[spec.durations.length - 1] : spec.durations.join(" or ");
      throw new Error("settings.duration must be an integer of " + range + " seconds");
    }
    valid.duration = settings.duration;
  }
  const enums = { aspect_ratio: route.aspectRatios, audio: route.audio, character_orientation: route.orientations };
  for (const key of Object.keys(enums)) {
    if (settings[key] === undefined) continue;
    if (!enums[key].includes(settings[key])) throw new Error("settings." + key + " must be one of: " + enums[key].join(", "));
    valid[key] = settings[key];
  }
  if (settings.multi_shot !== undefined) {
    if (typeof settings.multi_shot !== "boolean") throw new Error("settings.multi_shot must be a boolean");
    valid.multi_shot = settings.multi_shot;
  }
  if (route.orientations && valid.character_orientation === undefined)
    throw new Error("settings.character_orientation is required: " + route.orientations.join(", "));
  return valid;
}

// external_task_id would let a caller look tasks up by an id the gateway does
// not own.
function validOptions(value) {
  if (value === undefined) return {};
  if (!isObject(value)) throw new Error("options must be an object");
  if (value.external_task_id !== undefined) throw new Error("options.external_task_id is not supported; query the task by its id instead");
  rejectUnknownKeys(value, ["watermark_info"], "options.");
  if (value.watermark_info === undefined) return {};
  const watermark = value.watermark_info;
  if (!isObject(watermark) || Object.keys(watermark).length !== 1 || typeof watermark.enabled !== "boolean")
    throw new Error("options.watermark_info must be {enabled: true|false}");
  return { watermark_info: { enabled: watermark.enabled } };
}

// The resolution whose shorter side is nearest the size's, and the aspect
// ratio nearest its own, for the host protocols.
function sizeSettings(size, resolutions, ratios) {
  const parts = trimmed(size).toLowerCase().split("x");
  const width = Number(parts[0]);
  const height = Number(parts[1]);
  if (parts.length !== 2 || !(width > 0) || !(height > 0)) throw new Error("size must be WIDTHxHEIGHT, such as 1280x720");
  const shorterSide = Math.min(width, height);
  const settings = { resolution: resolutions[0] };
  for (const resolution of resolutions) {
    if (Math.abs(Math.log(shorterSide / RESOLUTION_SIDES[resolution])) < Math.abs(Math.log(shorterSide / RESOLUTION_SIDES[settings.resolution])))
      settings.resolution = resolution;
  }
  let distance = Infinity;
  for (const ratio of ratios || []) {
    if (ratio === "adaptive") continue;
    const sides = ratio.split(":").map(Number);
    const ratioDistance = Math.abs(Math.log(width / height) - Math.log(sides[0] / sides[1]));
    if (ratioDistance < distance) {
      settings.aspect_ratio = ratio;
      distance = ratioDistance;
    }
  }
  return settings;
}

// A host-protocol request as TokenHub's wire request: text-to-video, or
// image-to-video with a first and an optional last frame; the omni-only models
// take the same input on omni-video. metadata holds TokenHub settings and wins
// over seconds and size.
function protocolRequest(model, spec, req) {
  const frames = Array.isArray(req.images) ? req.images : [];
  let endpoint = "omni-video";
  if (spec.endpoints["text-to-video"]) endpoint = frames.length ? "image-to-video" : "text-to-video";
  else if (!spec.endpoints[endpoint]) throw new Error(model + " is served on its native motion-control route only");
  const settings = req.size === undefined ? {} : sizeSettings(req.size, spec.resolutions, spec.endpoints[endpoint].aspectRatios);
  if (req.seconds !== undefined) settings.duration = req.seconds;
  Object.assign(settings, objectOrEmpty(req.settings));
  if (endpoint === "text-to-video") return { endpoint: endpoint, body: { prompt: req.prompt, settings: settings } };
  const contents = req.prompt ? [{ type: "prompt", text: req.prompt }] : [];
  ["first_frame", "last_frame"].forEach(function (type, index) {
    if (frames[index]) contents.push({ type: type, url: frames[index] });
  });
  return { endpoint: endpoint, body: { contents: contents, settings: settings } };
}

// The request sent to TokenHub, validated for the machine model, and the
// tokens it reserves. The model-dependent checks live here because only the
// driver knows the model a channel mapping resolves to.
function submission(ctx) {
  const req = objectOrEmpty(ctx.requestBody);
  const model = trimmed(ctx.upstreamModel || ctx.model || req.model);
  const spec = lookup(MODELS, model);
  if (!spec) throw new Error("model must be one of: " + Object.keys(MODELS).join(", "));
  const wire = req.endpoint ? { endpoint: req.endpoint, body: objectOrEmpty(req.body) } : protocolRequest(model, spec, req);
  const endpoint = wire.endpoint;
  const route = lookup(spec.endpoints, endpoint);
  if (!route) throw new Error(model + " does not support " + endpoint);

  const body = { model: model };
  let contents = [];
  if (endpoint === "text-to-video") {
    rejectUnknownKeys(wire.body, ["prompt", "settings", "options"], "");
    if (typeof wire.body.prompt !== "string" || !wire.body.prompt.trim()) throw new Error("prompt must be a non-empty string");
    body.prompt = wire.body.prompt;
  } else {
    rejectUnknownKeys(wire.body, ["contents", "settings", "options"], "");
    contents = validContents(endpoint, wire.body.contents, req.upload);
    body.contents = contents;
  }
  const settings = validSettings(spec, route, endpoint, wire.body.settings);
  if (Object.keys(settings).length) body.settings = settings;
  const options = validOptions(wire.body.options);
  if (Object.keys(options).length) body.options = options;

  if (endpoint === "image-to-video" && !hasContent(contents, ["first_frame"])) throw new Error("contents must include a first_frame");
  if (hasContent(contents, ["last_frame"]) && !hasContent(contents, ["first_frame"])) throw new Error("a last_frame requires a first_frame");
  if (endpoint === "motion-control" && !(hasContent(contents, ["image"]) && hasContent(contents, ["video"])))
    throw new Error("contents must include an image and a video");
  if (route.aspectRatioRequired && !settings.aspect_ratio && !hasContent(contents, ["first_frame", "feature_video", "base_video"]))
    throw new Error("settings.aspect_ratio is required without a first_frame or a reference video");

  const videoInput = endpoint === "omni-video" && hasContent(contents, VIDEO_INPUT_TYPES);
  const edit = hasContent(contents, ["base_video"]);
  let seconds = settings.duration || spec.defaultSeconds || DEFAULT_SECONDS;
  if (endpoint === "motion-control") seconds = MOTION_MAX_SECONDS[settings.character_orientation];
  else if (videoInput && spec.inputVideoSeconds) {
    // A v4 edit without a duration is as long as its input video.
    if (edit && !settings.duration) seconds = spec.inputVideoSeconds;
    seconds = Math.max(seconds * 2, spec.inputVideoSeconds + seconds);
  } else if (edit) seconds = EDIT_MAX_SECONDS;

  const audio = settings.audio === "native" || settings.audio === "original";
  let rates = spec.rates.silent;
  if (videoInput && spec.rates.reference) rates = spec.rates.reference;
  else if (audio && hasContent(contents, ["voice"]) && spec.rates.voice) rates = spec.rates.voice;
  else if (audio && spec.rates.audio) rates = spec.rates.audio;
  // A resolution the variant has no rate for, which TokenHub refuses, reserves the dearest.
  const rate = lookup(rates, settings.resolution || spec.defaultResolution || DEFAULT_RESOLUTION) || Math.max.apply(null, Object.values(rates));

  const action = endpoint === "image-to-video" && hasContent(contents, ["last_frame"]) ? "first_tail_to_video" : ACTIONS[endpoint];
  return { endpoint: endpoint, body: body, action: action, tokens: rate * seconds };
}

function decodeNative(endpoint) {
  return function (ctx) {
    const body = Object.assign({}, jsonObjectBody(ctx));
    const model = trimmed(body.model);
    if (!model) throw new Error("model is required");
    delete body.model;
    return { kind: "submit", model: model, requestBody: { model: model, endpoint: endpoint, body: body } };
  };
}

// The task entry of a TokenHub reply: the task a submission answers, or the
// entry of the list a query for that one task answers. Presenters see the
// gateway's task id in place of TokenHub's, so a single entry is the task.
function taskEntry(reply, taskId) {
  const data = objectOrEmpty(reply).data;
  if (!Array.isArray(data)) return objectOrEmpty(data);
  const entry = data.find(function (item) {
    return isObject(item) && item.id === taskId;
  });
  return objectOrEmpty(entry || (data.length === 1 ? data[0] : null));
}

function videoOutput(entry) {
  const outputs = Array.isArray(entry.outputs) ? entry.outputs : [];
  return objectOrEmpty(
    outputs.find(function (output) {
      return isObject(output) && output.type === "video" && trimmed(output.url);
    })
  );
}

function reportedTokens(reply) {
  const tokens = Number(objectOrEmpty(objectOrEmpty(reply).tokenhub_usage).total_tokens);
  return Number.isFinite(tokens) && tokens > 0 ? tokens : 0;
}

export const native = {
  textToVideo: decodeNative("text-to-video"),
  imageToVideo: decodeNative("image-to-video"),
  omniVideo: decodeNative("omni-video"),
  motionControl: decodeNative("motion-control"),
  taskCreated: function (ctx, task) {
    const reply = objectOrEmpty(task.data);
    return Object.assign({}, reply, { data: Object.assign({}, objectOrEmpty(reply.data), { id: task.task_id }) });
  },
  // TokenHub's last reply for the task. The gateway can fail a task TokenHub
  // still reports as running (poll failures or the task timeout); it then
  // reads failed.
  taskStatus: function (ctx, task) {
    const reply = objectOrEmpty(task.data);
    const entry = Object.assign(
      { status: "submitted", create_time: task.created_at * 1000, update_time: (task.updated_at || task.created_at) * 1000 },
      taskEntry(reply, task.task_id),
      { id: task.task_id }
    );
    if (task.status === "FAILURE" && entry.status !== "failed") {
      entry.status = "failed";
      entry.message = task.fail_reason || "";
    }
    return Object.assign({ code: 0, message: "SUCCEED", request_id: "" }, reply, { data: [entry] });
  },
  error: function (ctx, error) {
    return { code: ERROR_CODES[error.httpStatus] || (error.httpStatus >= 500 ? 5000 : 1200), message: error.message, request_id: error.requestId || "" };
  },
};

export function buildSubmitRequest(ctx) {
  const planned = submission(ctx);
  return {
    url: apiRoot(ctx) + "/" + planned.endpoint,
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, requestHeaders(ctx)),
    body: planned.body,
    action: planned.action,
  };
}

export function parseSubmitResponse(ctx, resp) {
  const reply = objectOrEmpty(resp.body);
  if (reply.code !== 0) throw new Error(trimmed(reply.message) || "TokenHub submission failed");
  const id = trimmed(objectOrEmpty(reply.data).id);
  if (!id) throw new Error("TokenHub returned no task id");
  return { taskId: id, taskData: reply };
}

export function extractUsage(ctx) {
  if (ctx.usagePurpose === "billing_ratios") return null;
  return { tokens: submission(ctx).tokens };
}

export function buildQueryRequest(ctx) {
  return { url: apiRoot(ctx) + "/tasks/" + encodeURIComponent(ctx.taskId), method: "GET", headers: requestHeaders(ctx) };
}

export function parseTaskResult(ctx, body) {
  const reply = objectOrEmpty(body);
  const entry = taskEntry(reply, ctx.taskId);
  const status = lookup(STATUSES, entry.status);
  if (!status) {
    const error = reply.code !== 0 && trimmed(reply.message);
    return { status: "UNKNOWN", reason: error || "unknown task status: " + String(entry.status || "") };
  }
  const result = { taskId: entry.id, status: status, reason: entry.message || "" };
  if (status === "FAILURE") result.progress = "100%";
  if (status !== "SUCCESS") return result;
  result.progress = "100%";
  const url = trimmed(videoOutput(entry).url);
  if (url) result.url = url;
  const tokens = reportedTokens(reply);
  if (tokens) result.totalTokens = tokens;
  return result;
}

// Without a positive total_tokens the reservation stands.
export function extractUsageOnComplete(task, result, body) {
  const tokens = reportedTokens(body);
  return result.status === "SUCCESS" && tokens ? { tokens: tokens } : null;
}

export function listArtifacts(task) {
  return task.status === "SUCCESS" && trimmed(videoOutput(taskEntry(task.data, task.taskId)).url) ? [{ key: "video", type: "video" }] : [];
}

// Videos are presigned object-storage URLs, not channel-host URLs.
export function buildContentRequest(ctx) {
  const url = ctx.artifactKey === "video" ? trimmed(videoOutput(taskEntry(ctx.data, ctx.upstreamTaskId)).url) : "";
  if (!url) throw new Error("artifact_not_found");
  return { url: url, method: ctx.clientRequest.method, credentialless: true };
}

function responsesInput(req) {
  const texts = [];
  const images = [];
  const input = req.input;
  if (typeof input === "string") texts.push(input);
  else if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === "string") {
        texts.push(item);
        continue;
      }
      if (!isObject(item)) continue;
      const content = item.content === undefined ? [item] : Array.isArray(item.content) ? item.content : [item.content];
      for (const part of content) {
        if (typeof part === "string") {
          texts.push(part);
          continue;
        }
        if (!isObject(part)) continue;
        if (["input_text", "text"].includes(part.type) && typeof part.text === "string") texts.push(part.text);
        if (["input_image", "image_url"].includes(part.type)) images.push(isObject(part.image_url) ? part.image_url.url : part.image_url);
      }
    }
  }
  return { prompt: texts.map(trimmed).filter(Boolean).join("\n"), images: images };
}

// The host-protocol request the driver reads: prompt, up to two frame images
// (an upload first), seconds, size, and TokenHub settings from metadata.
function protocolIntent(model, fields) {
  const images = fields.upload ? [fields.upload] : [];
  for (const image of fields.images) {
    if (typeof image === "string" && image.trim() && !images.includes(image.trim())) images.push(image.trim());
  }
  if (images.length > 2) throw new Error("at most 2 images are allowed: the first and the last frame");
  if (!fields.prompt && !images.length) throw new Error("input is required");
  if (fields.metadata !== undefined && !isObject(fields.metadata)) throw new Error("metadata must be an object");
  const requestBody = { model: model, prompt: fields.prompt, images: images };
  if (fields.upload) requestBody.upload = fields.upload;
  if (fields.seconds !== undefined) {
    const seconds = typeof fields.seconds === "string" && fields.seconds.trim() !== "" ? Number(fields.seconds) : fields.seconds;
    if (!Number.isInteger(seconds)) throw new Error("seconds must be an integer");
    requestBody.seconds = seconds;
  }
  if (fields.size !== undefined) requestBody.size = fields.size;
  if (fields.metadata !== undefined) requestBody.settings = fields.metadata;
  let action = "text_to_video";
  if (images.length) action = images.length > 1 ? "first_tail_to_video" : "image_to_video";
  return { kind: "submit", model: model, action: action, requestBody: requestBody };
}

function responsesVideoText(ctx) {
  const artifact = ctx && ctx.artifacts && ctx.artifacts.video;
  const url = trimmed(artifact && artifact.url);
  if (!url) throw new Error("video artifact is unavailable");
  const escaped = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return '<video controls src="' + escaped + '"></video>';
}

export const protocols = {
  openai_responses: {
    decodeRequest: function (ctx) {
      const req = jsonObjectBody(ctx);
      const model = trimmed(ctx.model);
      if (!model) throw new Error("model is required");
      if (req.input !== undefined && typeof req.input !== "string" && !Array.isArray(req.input)) throw new Error("input must be a string or array");
      if (req.images !== undefined && !Array.isArray(req.images)) throw new Error("images must be an array");
      const input = responsesInput(req);
      return protocolIntent(model, {
        prompt: input.prompt || trimmed(req.prompt),
        images: [req.image, req.input_reference].concat(req.images || [], input.images),
        seconds: req.seconds === undefined ? req.duration : req.seconds,
        size: req.size,
        metadata: req.metadata,
      });
    },
    renderEvents: function (ctx, task, previousState) {
      const status = String(task.status || "UNKNOWN").toUpperCase();
      const value = Number(String(task.progress || "").replace("%", ""));
      const progress = Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
      const state = { status: status, progress: progress };
      if (status === "SUCCESS") {
        const events = previousState && previousState.status === status ? [] : [{ type: "output", data: responsesVideoText(ctx) }];
        return { events: events, state: state, done: true };
      }
      if (status === "FAILURE")
        return { events: [{ type: "error", code: "task_failed", message: task.fail_reason || "task failed" }], state: state, done: true };
      if (previousState && previousState.status === status && previousState.progress === progress) return { events: [], state: state, done: false };
      const event = { type: "progress", message: status.toLowerCase() };
      if (progress !== null) event.progress = progress;
      return { events: [event], state: state, done: false };
    },
    renderFinal: function (ctx, _task) {
      return {
        output: [
          {
            type: "message",
            status: "completed",
            role: "assistant",
            content: [{ type: "output_text", text: responsesVideoText(ctx), annotations: [], logprobs: [] }],
          },
        ],
        metadata: { vendor: "t0ng7u_tokenhub-kling" },
      };
    },
  },
  openai_video: {
    decodeRequest: function (ctx) {
      if (!ctx.body || (ctx.body.kind !== "json" && ctx.body.kind !== "multipart")) throw new Error("JSON or multipart body required");
      let req = {};
      let upload;
      if (ctx.body.kind === "json") {
        if (!isObject(ctx.body.value)) throw new Error("JSON object required");
        req = ctx.body.value;
      } else {
        const fields = ctx.body.fields || {};
        for (const name of Object.keys(fields)) {
          if (fields[name].length > 1) throw new Error(name + " must be provided once");
          req[name] = fields[name][0];
        }
        for (const file of ctx.body.files || []) {
          if (file.field !== "input_reference") throw new Error("unexpected file field: " + file.field);
          if (upload) throw new Error("input_reference must be provided once");
          upload = { __fileRef: file.ref, encoding: "dataUrl", maxBytes: MAX_UPLOAD_BYTES };
        }
        if (req.metadata !== undefined) {
          try {
            req.metadata = JSON.parse(req.metadata);
          } catch (e) {
            throw new Error("metadata must be a JSON object string", { cause: e });
          }
        }
      }
      if (req.images !== undefined && !Array.isArray(req.images)) throw new Error("images must be an array");
      return protocolIntent(ctx.model, {
        prompt: trimmed(req.prompt),
        upload: upload,
        images: [req.input_reference, req.image].concat(req.images || []),
        seconds: req.seconds === undefined ? req.duration : req.seconds,
        size: req.size,
        metadata: req.metadata,
      });
    },
    // The host sets id, object, model, status, progress and the timestamps.
    render: function (ctx, task) {
      const entry = taskEntry(task.data, task.task_id);
      const output = { id: task.task_id, object: "video", model: "", status: VIDEO_STATUSES[task.status] || "unknown" };
      const seconds = videoOutput(entry).duration;
      if (seconds) output.seconds = seconds;
      if (task.status === "FAILURE") output.error = { code: "task_failed", message: trimmed(task.fail_reason) || trimmed(entry.message) };
      return output;
    },
  },
};
