const {
    getAppProperty
} = require("./requestHelper.js");

async function getJwtSecret(addon, httpClient)  {
    const jwtSecret = await getAppProperty(httpClient, "jwtSecret");

    return jwtSecret ? jwtSecret : addon.config.docServer().default.secret;
}

async function getJwtHeader(addon, httpClient) {
    const jwtHeader = await getAppProperty(httpClient, "jwtHeader");

    return jwtHeader ? jwtHeader : addon.config.docServer().default.authorizationHeader
}

module.exports = {
    getJwtSecret,
    getJwtHeader
};