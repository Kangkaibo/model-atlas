# 在线使用与部署

## 访客直接查询

本项目已上线：[打开模型档案网站](https://kangkaibo.github.io/model-atlas/#catalog)。访客只需要浏览器，无需下载仓库、安装依赖、登录GitHub或自行部署。

从GitHub仓库首页顶部的“在线查询”链接即可进入。查询、筛选、对比和查看官方出处都在网站内完成；浏览器地址栏中的查询链接可以直接分享。

以下部署步骤仅用于维护者建立自己的副本，普通访客不需要操作。

## 维护者部署自己的副本

将本项目放到自己的GitHub仓库，默认分支使用`main`。在仓库`Settings → Pages → Build and deployment → Source`选择`GitHub Actions`，然后在Actions里运行`Deploy Pages`或推送一次main。

部署工作流检查并上传`dist/`，不会发布数据维护脚本或研究缓存。网页资源采用相对路径，兼容`https://账号.github.io/仓库名/`。以成功部署返回的实际URL为准。

官方说明：[GitHub Pages自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

## 离线与源码包

```bash
npm run build
npm run check
npm test
npm run package
```

`artifacts/`包含离线站、独立源码ZIP和SHA256校验文件。只打包明确的公开目录，不包含Git历史、凭据、个人工作区或托管账号配置。

推送`v*`标签时Release工作流会进行同样的检查和打包，再发布GitHub Release。无需为了使用网站下载模型权重。

## Fork

Fork后启用Actions，并按上述步骤启用Pages。首次运行来源检查会使用仓库自带对照；按需修改作者列表和检查周期。Fork的计划任务可能默认未启用，需要在Actions中主动启用。

仓库内的项目链接可用`scripts/set_repository.py --repository 账号/仓库名`更新后再构建。
