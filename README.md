# vend-tools

A command-line-interface (CLI) which allows you to easily perform custom tasks for your vendhq.com instance

```
$ vend-tools 
Usage: vend-tools COMMAND [OPTIONS]

  This command-line-interface (CLI) allows you to easily perform custom tasks for your vendhq.com instance.

Available commands:

export-all-products         Export All Products (CSV file format by default)
export-all-suppliers        Export All Suppliers (CSV file format by default)
fetch-product-by-id         Fetches a product by id
fetch-product-by-sku        Fetches a product by SKU
fetch-product-by-handle     Fetches a product by handle
list-products               List Products (200 at a time)
list-suppliers              List Suppliers (200 at a time)
report-costs-for-suppliers  Report the costs for each supplier per outlet
```

# Need Help?

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/ShoppinPal/vend-tools?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

1. Ask for help with installation,
2. Discuss new features you're looking for,
3. Let us know if we met or exceeded expentations!

Pre-requisites for Windows7
===========================
1. Download git from `http://git-scm.com/download/win` and install it
2. Open `cmd` (please do so as an admin)
3. `git clone git://github.com/hakobera/nvmw.git "%HOMEDRIVE%%HOMEPATH%\.nvmw"`
  1. If you are setup such that there is a `c:\` drive and a `u:\` user-drive mapped together then do NOT use `%HOMEDRIVE%%HOMEPATH%`
  2. Instead stick with absolute paths and use something like `git clone git://github.com/hakobera/nvmw.git "c:\dev\.nvmw"` etc.
  3. And run `cmd` as an administrator
4. `setx /M PATH "%HOMEDRIVE%%HOMEPATH%\.nvmw;%PATH%"`
  1. or `setx /M PATH "c:\dev\.nvmw;%PATH%"`
5. quit and start a new `cmd`
6. Run `nvmw install v0.10.36` but thefirst time fails, second time will work so run it again: `nvmw install v0.10.36`
7. Running `node --version` should spit out: `v0.10.36`
8. `setx /M PATH "%HOMEDRIVE%%HOMEPATH%\.nvmw\v0.10.36;%PATH%"`
  1. or `setx /M PATH "c:\dev\.nvmw\v0.10.36;%PATH%"`
9. quit and start a new `cmd`

Pre-requisites for mac
======================
1. *TODO: Need to write up a "spoon-feeding" version of these instructions*

How to Install
==============
1. Make sure you have `git` and `nodejs` installed (`nvm`/`nvmw` is optional)
2. run: `npm install -g vend-tools`
3. run: `vend-tools configure`
  1. You will need your own vend credentials to make vend-tools work so goto https://developers.vendhq.com/ and `Register as a developer` then create a new application for yourself at https://developers.vendhq.com/developer/applications as this will provide you with `client_id` and `client_secret`
  2. To get `refresh_token` and `access_token`, you have two choices:
    1. Use the tooling provided by the runscope website for getting Vend OAuth tokens: https://www.runscope.com/oauth2_tool
      1. Authorize URL: `https://{DOMAIN_PREFIX}.vendhq.com/connect`      
      2. Access Token URL: `https://{DOMAIN_PREFIX}.vendhq.com/api/1.0/token`
    2. Or, you may refer to our example https://github.com/ShoppinPal/vend-oauth-example
4. Start using from anywhere in the command-line/terminal: `vend-tools`

Simple-Legal-Speak
==================

This is a labor of love. This effort is not funded, endorsed or sponsored by Vend.

This module is being written out of sheer respect for Vend's uncanny success at platformizing retail with their public API. It will hopefully help democratize access further by adding ease of use for developers. The authors of this module are not Vend employees and Vend didn't ask us to do this. Retail is a tricky/competitive space and we want to help reduce development churn, by open-sourcing pieces that allow folks to build iterative solutions. When in doubt, be sure to pay attention to the details expressed in the LICENSE file.

Who are we?
===========

ShoppinPal is a team of engineers and product guys with background in developing core systems at well-known Silicon Valley companies. We have deep expertise with Vend APIs. Several retailers use our ecommerce add-on, which works beautifully with Vend. We would love to assist you with any custom development needs that help you get the most out of Vend. We are listed in http://www.vendhq.com/expert-directory?region=0&service=12
