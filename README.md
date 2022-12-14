# @wharfkit/resource-provider-plugin

A `transactPlugin` for use with the `@wharfkit/session` library that provides resources to perform transactions.

## Caveats

-   Resource Provider API endpoint must conform to the Resource Provider API specification.
-   To enable fees, the `allowFees` parameter must be specified and set to `true`.
-   Any fees must be paid in the networks system token, deployed on the `eosio.token` account using the standard token contract.

## Installation

The `@wharfkit/resource-provider-plugin` package is distributed as a module on [npm](https://www.npmjs.com/package/@wharfkit/resource-provider-plugin).

```
yarn add @wharfkit/resource-provider-plugin
# or
npm install --save @wharfkit/resource-provider-plugin
```

## Usage

TODO

## Developing

You need [Make](https://www.gnu.org/software/make/), [node.js](https://nodejs.org/en/) and [yarn](https://classic.yarnpkg.com/en/docs/install) installed.

Clone the repository and run `make` to checkout all dependencies and build the project. See the [Makefile](./Makefile) for other useful targets. Before submitting a pull request make sure to run `make lint`.

---

Made with ☕️ & ❤️ by [Greymass](https://greymass.com), if you find this useful please consider [supporting us](https://greymass.com/support-us).
