---
changelogVersion: 1
plugin: "t0ng7u_tokenhub-kling"
version: "1.0.0"
locale: "en"
translations:
  zh-CN: CHANGELOG.zh-CN.md
---
# Changelog

## [1.0.0]

### Added

- Generate Kling videos through Tencent Cloud TokenHub with ten models, from `kling-video-v4-flash` and `kling-video-v4` to `kling-video-motion-control-v2.6`.
- Call TokenHub's own text-to-video, image-to-video, omni video and motion control paths under `/v1/wand/kling`, and query tasks at `/v1/wand/kling/tasks/{task_id}`.
- Use `kling-video-v4` middle frames and its omni video `audio` setting, and `kling-video-v4-flash` text, first-frame and omni video generation.
- Create videos with `POST /v1/videos` and `POST /v1/responses` for every model except motion control, including uploaded first frames.
- Bill each task in TokenHub tokens with one `tokens` price field: the published rate is reserved at submission and the tokens TokenHub reports settle the task.
- Relay through another New API gateway that has this plugin installed, using a New API channel.
