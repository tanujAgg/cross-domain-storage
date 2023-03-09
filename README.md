# Cross Domain Cookie

A package that makes sharing local data across domains a thing of ease.

This package outputs...

- A script to be hosted in an HTML document on a central domain, the "hub domain", where all user data is stored.
- A module to be used in applications on "satellite" domains, which retrieves and sets localStorage values on the hub domain.

<div style="margin: 5px 10px; border: solid 1px #000fbe24; background: #0366d60f; padding: 10px;">
  <b>
    A Note on the Name
  </b>
  <p>
    Yes, yes - it's called "Cross Domain Cookie", but it uses localStorage.  In the first iteration, cookies were used, but due to current and upcoming changes to browser cookie policies, not to mention larger hard drive allowances for LS, it made more sense to move it to be localStorage based.
  </p>
  <p>
    "Cross Domain Cookie" it will remain, though.
  </p>
</div>

## Overview

localStorage values are the pieces of data we save to a user's hard drive for later usage by our application. Each value we save is scoped to the domain the user is on when the save takes place. Likewise, when retrieving the values, we're restricted to only access those values saved to the domain our code is running on.

This is great, as it disallows a user's shopping site from grabbing data from, say, their social media site, without the consent of the user or the social media site.

Where this becomes painful - sometimes a site owner owns two sites and wants to let the user pass easily between them with all of their saved data. If, for instance, you have a suite of sites with different domains and the user signs in on one, you'd rather not make them sign in again as they traverse to another. This makes for bad UX for users who want a seamless experience.

Enter cross-domain-storage. This package allows you to store all user data on a central (hub) domain, and set or access it from dependent (satellite) domains. It also allows you to consolidate your data retrieval logic on the central domain, so that all satellite domains need simply fetch it. This allows for a much more DRY approach.

## Usage

cross-domain-storage provides both code for the iframe hosted on the hub domain, as well as the data getters and setters for the satellite domains.

The minimum setup just involves deploying the iframe code with a list of access-listed satellite domains to your hub domain, and using the `get` and `set` functions in apps on the satellite domains.

<div style="margin: 5px 10px; border: solid 1px #000fbe24; background: #0366d60f; padding: 10px;">
  <b>
    Note
  </b>
  <p>
    You can find full examples of usage in the /examples directory of the repo.  Note the "Smoke Tests" section below for how to run examples locally.
  </p>
</div>

### Setting and Getting Data from the Satellite Applications

Iframe on **hub.com/cross-domain-storage.html**:

```javascript
import {createIframe} from "cross-domain-storage";

// Sites allows to access data on the hub domain:
const dependentDomains = ["satellite1.com", "satellite2.com"];

// Sets up the contents of the iframe:
createIframe({dependentDomains});

// That's it!  Including this code in an HTML file on your central domain readies you for data sharing across domains.
```

Somewhere in the app on **satellite1.com**:

```javascript
import {set} from "cross-domain-storage";

const result = await set({
  // This is the URL at which you've hosted the output of `createIframe`, above:
  iframeUrl: "https://hub.com/cross-domain-storage.html",
  dataKey: "chocolate-chip-oatmeal",
  data: {
    c: "is for localStorage",
    and: "that's good enough for me.",
  },
});
```

Somewhere in the app on **satellite2.com**:

```javascript
import {get} from "cross-domain-storage";

const result = await get({
  iframeUrl: "https://hub.com/cross-domain-storage.html",
  dataKey: "chocolate-chip-oatmeal",
});

console.log(result);
/* Logs:
{
    c: 'is for localStorage',
    and: 'that\'s good enough for me.'
}
*/
```

Under the hood, the `get` and `set` functions script-inject the iframe into the page, then send it requests to access its localStorage space. The iframe contains code to interpret the requests, and get and set data as instructed.

However, one of the strengths of cross-domain-storage is that it allows you to make the iframe the source of truth, alleviating potential race conditions and non-DRY behavior in your satellite apps. This is done by using handlers in the iframe to do the cookie fetching, so that satellite apps can take the data acquisition process for granted. Read on...

### Iframe Handlers

By setting a `handler` for a `dataKey` in the iframe, your satellite apps can call for data, and the hub iframe will handle the getting of the data. This means no one app has to set the data before others can retrieve it.

Iframe on **hub.com/cross-domain-storage.html**:

```javascript
import {createIframe} from "cross-domain-storage";

// A function of the user's choosing, which returns a primitive or stringify-able value:
import {createUserUuid} from "my-data-getter";

const dependentDomains = ["satellite1.com", "satellite2.com"];

createIframe({
  dependentDomains,
  dataConfigs: [
    {
      dataKey: "userUuid",
      handler: createUserUuid,
    },
  ],
});
```

In the above case, the iframe will now host our data getter, `createUserUuid`. The value returned by this synchronous or async function will be stored at the `'userUuid'` key in the iframe, and become available to all satellite domains.

We now can add the following code to satellite1.com and satellite2.com. The first satellite to call the iframe will trigger the iframe to execute `createUserUuid` and cache the response on the hub. In the second call, the iframe will reply immediately with the cached value:

Somewhere in the app on **satellite1.com**:

```javascript
import {get} from "cross-domain-storage";

const result = await get({
  iframeUrl: "https://hub.com/cross-domain-storage.html",
  dataKey: "userUuid",
});

console.log(result); // 123e4567-e89b-12d3-a456-426655440000
```

## API

### `createIframe(options)`

The function for producing the code that lives in the iframe on the hub domain. Include the output in an HTML document, and deploy to your hub domain.

#### `options` Parameters

| option                   | description                                                                                                                                                                                                           | required | type     | example                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | ----------------------------------------------------------- |
| `dependentDomains`       | An array of the domains allowed to access data on the hub domain. Do not include protocols or paths.                                                                                                                  | `true`   | Array    | `[ 'example.com' ]`                                         |
| `dataConfigs`            | An array of configurations for each data value the iframe will manage.                                                                                                                                                | `false`  | Array    | See below.                                                  |
| `dataConfigs[n].dataKey` | The localStorage key the data will be stored under. Also used when retrieving the value.                                                                                                                              | `true`   | String   | `'snickerdoodle'`                                           |
| `dataConfigs[n].handler` | The function that retrieves the data to be cached in localStorage. Optionally receives an argument the app sends when requesting the datum. Data returned from the `handler` **must** be stringify-able or primitive. | `true`   | Function | `` (userName) => axios(`${myEndpoint}?user=${userName}`) `` |

#### Returns

`undefined`

### `set(options)`

The function used by the application for setting the localStorage value on the hub domain.

<div style="margin: 5px 10px; border: solid 1px #000fbe24; background: #0366d60f; padding: 10px;">
  <b>Note</b>
  <p>
    Do not use `set` if the `dataKey` is included a `dataConfigs` configured in the `createIframe` function on the hub. In this case, the iframe becomes the setter, and the application needs only use the `get` function (below) to retrieve the data.
  </p>
</div>

#### `options` Parameters

| option      | description                                                           | required | type                                   | example                       |
| ----------- | --------------------------------------------------------------------- | -------- | -------------------------------------- | ----------------------------- |
| `iframeUrl` | The full URL on the hub domain where the iframe lives.                | `true`   | String                                 | `'https://my-hub-domain.com'` |
| `dataKey`   | The localStorage key the data will be stored on under the hub domain. | `true`   | String                                 | `'samoa'`                     |
| `data`      | The value to be stored.                                               | `true`   | Any primitive or stringify-able value. | `{ c: 'is for cookie' }`      |
| `expires`   | The number of days before the data expires. Defaults to 30 years.     | `false`  | Number                                 | `1`                           |

#### Returns

Data sent with request to the hub domain, after being subjected to localStorage caching. Note this will be the value after it has been subjected to `JSON.stringify`, `JSON.parse` and the application of the expiry.

### `get(options)`

The function used by the application for getting the datum from the hub domain. Must reference a `dataKey` previously set by the `set` function or configuring in a `dataConfigs` object passed to the `createIframe` function.

#### `options` Parameters

| option           | description                                                                                                                                                                                                    | required | type                                   | example                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------- | ----------------------------- |
| `iframeUrl`      | The full URL on the hub domain where the iframe lives.                                                                                                                                                         | `true`   | String                                 | `'https://my-hub-domain.com'` |
| `dataKey`        | The name under which the datum is stored on the hub domain.                                                                                                                                                    | `true`   | String                                 | `'samoa'`                     |
| `handlerPayload` | The value that the iframe's `dataConfig`'s handler will receive. Only applicable to `dataKey`s with `dataConfig` objects passed into the `createIframe` function on the hub domain.                            | `false`  | Any primitive or stringify-able value. | `{ userType: 'B' }`           |
| `resetData`      | If `true`, will purge the data, forcing the iframe's handler to re-retrieve the data value. Only applicable to `dataKey`s with `dataConfig` objects passed into the `createIframe` function on the hub domain. | `false`  | Boolean                                | `true`                        |

#### Returns

Data previously stored at the `dataKey` on the hub domain. If this is an object, it will be subjected to `JSON.parse` prior to arriving back in the app.

## To Test

### Unit tests

[TBD] I'm the worst.

### Smoke Tests

For some hacky smoke testing, add the following entries to your etc/hosts file:

```bash
127.0.0.1	dependant-site.com
127.0.0.1	source-of-truth.com
```

In one terminal run:

```bash
npm run dev-iframe
```

In a second terminal run:

```bash
npm run dev-app
```

Navigate to <http://dependant-site.com:2222>, and observe the output on the page.

You'll note no values are stored in the localStorage of <http://dependant-site.com:2222>. If you navigate to <http://source-of-truth.com:1111>, you'll find all example values stored there.

### Build

To build the bundle, run:

```bash
npm run build
```

The output can be found in the `/lib` folder.

# Special Thanks

cross-domain-storage is forked from https://github.com/vireshshah/cross-domain-cookie. Many thanks to Viresh Shah.
