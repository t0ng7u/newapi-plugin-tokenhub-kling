---
changelogVersion: 1
plugin: "t0ng7u_tokenhub-kling"
version: "1.0.0"
locale: "zh-CN"
---
# Changelog

## [1.0.0]

### Added

- 通过腾讯云 TokenHub 生成可灵视频，支持从 `kling-video-v4-flash`、`kling-video-v4` 到 `kling-video-motion-control-v2.6` 共十个模型。
- 支持调用 `/v1/wand/kling` 下 TokenHub 原生的文生视频、图生视频、全能视频和动作控制接口，并在 `/v1/wand/kling/tasks/{task_id}` 查询任务。
- 支持 `kling-video-v4` 的中间帧和全能视频的 `audio` 设置，以及 `kling-video-v4-flash` 的文生视频、首帧图生视频和全能视频。
- 除动作控制外的所有模型都可以通过 `POST /v1/videos` 和 `POST /v1/responses` 生成视频，支持上传首帧图片。
- 每个任务按 TokenHub token 计费，价格表只有一个 `tokens` 字段：提交时按公布费率预扣，按 TokenHub 上报的 token 数结算。
- 可以用 New API 类型的渠道，经由另一个安装了本插件的 New API 网关转发。
