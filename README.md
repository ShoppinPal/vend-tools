# vend-tools

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/ShoppinPal/vend-tools?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

A command-line-interface (CLI) which allows you to easily perform custom tasks for your vendhq.com instance

```
$ vend-tools 
Usage: vend-tools COMMAND [OPTIONS]

  This command-line-interface (CLI) allows you to easily perform custom tasks for your vendhq.com instance.

Available commands:

export-all-products         Export All Products (CSV file format by default)
report-costs-for-suppliers  Report the costs for each supplier per outlet
```


How to Install
==============
1. Make sure you have `git` and `nodejs` installed (`nvm`/`nvmw` is optional)
2. `git clone https://github.com/ShoppinPal/vend-tools.git`
3. `cd vend-tools`
4. *[Optional]* Create `client.json` and `oauth.json` files so that you don't need to type in really long commands
  1. `client.json`
  ```
  {
    "token_service": "https://{DOMAIN_PREFIX}.vendhq.com/api/1.0/token",
    "client_id": "fill it in",
    "client_secret": "fill it in"
  }
  ```
  2. `oauth.json`
  ```
  {
    "access_token": "fill it in",
    "token_type": "Bearer",
    "refresh_token": "fill it in",
    "domain_prefix": "fill it in"
  }
  ```

5. `npm install`
6. `npm link`
7. Start using from anywhere in the command-line/terminal: `vend-tools`

Pre-requisites for Windows7
===========================
1. Download git from `http://git-scm.com/download/win` and install it
2. Open `cmd`
3. `git clone git://github.com/hakobera/nvmw.git "%HOMEDRIVE%%HOMEPATH%\.nvmw"`
  1. If you are setup such that there is a `c:\` drive and a `u:\` user-drive mapped together then do NOT use `%HOMEDRIVE%%HOMEPATH%`
  2. Instead stick with absolute paths like `c:\whatever\.nvmw` etc.
  3. And run `cmd` as an administrator
4. `setx /M PATH "%HOMEDRIVE%%HOMEPATH%\.nvmw;%PATH%"`
5. quit and start a new `cmd`
6. Run `nvmw install v0.10.33` but thefirst time fails, second time will work so run it again: `nvmw install v0.10.33`
7. Running `node --version` should spit out: `v0.10.33`
8. `setx /M PATH "%HOMEDRIVE%%HOMEPATH%\.nvmw\v0.10.33;%PATH%"`
9. quit and start a new `cmd`

Pre-requisites for mac
======================
1. *TODO: Need to write up a "spoon-feeding" version of these instructions*

Simple-Legal-Speak
==================

This is a labor of love. This effort is not funded, endorsed or sponsored by Vend.

This module is being written out of sheer respect for Vend's uncanny success at platformizing retail with their public API. It will hopefully help democratize access further by adding ease of use for developers. The authors of this module are not Vend employees and Vend didn't ask us to do this. Retail is a tricky/competitive space and we want to help reduce development churn, by open-sourcing pieces that allow folks to build iterative solutions. When in doubt, be sure to pay attention to the details expressed in the LICENSE file.

Who are we?
===========

ShoppinPal is a team of engineers and product guys with background in developing core systems at well-known Silicon Valley companies. We have deep expertise with Vend APIs. Several retailers use our ecommerce add-on, which works beautifully with Vend. We would love to assist you with any custom development needs that help you get the most out of Vend. We are listed in http://www.vendhq.com/expert-directory?region=0&service=12
