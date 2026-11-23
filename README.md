---
translations:
  zh-CN: README.zh-CN.md
---
# TokenHub Kling

Generates Kling videos through Tencent Cloud TokenHub: text-to-video, image-to-video, omni video (reference images, reference videos, video editing, elements and voices) and motion control.

## Channel setup

1. Create a channel of the Task Plugin type and bind TokenHub Kling.
2. Paste an API key from the TokenHub console as the channel key. The plugin sends it as `Authorization: Bearer` followed by the key.
3. Leave the API address empty to use the default `https://tokenhub.tencentmaas.com`. For the international site, set `https://tokenhub-intl.tencentcloudmaas.com`.
4. In the TokenHub console, enable postpaid billing for the Kling models you offer.

To relay through another New API gateway that also has this plugin installed, use a New API channel instead, add TokenHub Kling to its plugins, and use a token of that gateway as the key. Requests then go to the plugin's own routes on that gateway under `/t0ng7u_tokenhub-kling`.

## Models and endpoints

| Model | Text-to-video | Image-to-video | Omni video | Motion control |
| --- | --- | --- | --- | --- |
| `kling-video-v4-flash` | yes | yes | yes | |
| `kling-video-v4` | yes | yes | yes | |
| `kling-video-v3` | yes | yes | | |
| `kling-video-v3-turbo` | yes | yes | | |
| `kling-video-v3-omni` | | | yes | |
| `kling-video-o1` | | | yes | |
| `kling-video-v2.6` | yes | yes | | |
| `kling-video-v2.5-turbo` | yes | yes | | |
| `kling-video-motion-control-v3.0` | | | | yes |
| `kling-video-motion-control-v2.6` | | | | yes |

Clients can call the gateway in three ways:

- TokenHub's own API, with the same request bodies as TokenHub: `POST /v1/wand/kling/text-to-video`, `/image-to-video`, `/omni-video` and `/motion-control`, then `GET /v1/wand/kling/tasks/{task_id}` with the id from `data.id`. The same routes are also served under `/t0ng7u_tokenhub-kling`.
- OpenAI videos: `POST /v1/videos`, `GET /v1/videos/{id}` and `GET /v1/videos/{id}/content`, for every model except motion control. `prompt` becomes the prompt, `input_reference` (a URL or an uploaded image) and `images` become the first and last frames, `seconds` the duration, and `size` picks the nearest resolution and aspect ratio. `metadata` holds TokenHub `settings` and overrides `seconds` and `size`.
- OpenAI Responses: `POST /v1/responses` with `stream`, without it, or with `background`, for the same models as OpenAI videos. Text parts form the prompt and image parts the frames; the reply carries an HTML `video` tag that plays the finished video from a gateway download link.

## Billing

The price table has one field, `tokens`, the video generation unit price per million TokenHub tokens. TokenHub bills every Kling model in tokens, so set a price per million tokens for each model you offer.

When a task is submitted, the gateway reserves TokenHub's published tokens per second for the model, resolution and variant (silent, with audio, with a voice, or with a reference video), multiplied by the reserved seconds:

- The requested `duration`, or the TokenHub default: 10 seconds for v4 and v4-flash, 5 seconds for the other models.
- v4 and v4-flash with a reference video, an edited video or an element: twice the output, or 30 seconds of input plus the output, whichever is longer. An edit without a duration counts as a 30-second input. An element counts as a video input because the request does not show whether it is a video character.
- An edited video (`base_video`) on v3-omni or o1: 16 seconds.
- Motion control: 10 seconds with `character_orientation` set to `image`, 30 seconds with `video`.

When the task succeeds, the charge is settled to `tokenhub_usage.total_tokens`, the tokens TokenHub reports for that task. If TokenHub reports no tokens, the reservation stands. Failed tasks are refunded.

## Example

```bash
curl https://gateway.example.com/v1/wand/kling/text-to-video \
  -H "Authorization: Bearer sk-..." \
  -H "Content-Type: application/json" \
  -d '{"model": "kling-video-v3", "prompt": "A girl sat on the train, looking out the window", "settings": {"resolution": "1080p", "duration": 5}}'
```

```bash
curl https://gateway.example.com/v1/wand/kling/tasks/task_xxxxxxxxxxxx \
  -H "Authorization: Bearer sk-..."
```

## Limits

- `options.external_task_id` is rejected; query a task by the id the gateway returns.
- Elements and voices are created with TokenHub's element and voice APIs directly; this plugin only references them by id.
- An image uploaded to `/v1/videos` is sent inline and may be at most 50 MB.
- Video links are temporary TokenHub storage URLs; download the video soon after the task succeeds, or fetch it through `/v1/videos/{id}/content`.
- Without a `duration`, TokenHub may take the length from the prompt. The charge still settles to the reported tokens.
