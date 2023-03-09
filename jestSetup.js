global.fetch = require('jest-fetch-mock');
global.location = {
    href: 'https://cross-domain-storage-test.com/'
};
process.env.VERSION = 'well.hello.there'
