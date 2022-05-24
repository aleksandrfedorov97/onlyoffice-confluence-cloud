const {
    getAppProperty
} = require("./requestHelper.js");
const jwt = require("atlassian-jwt");

async function getJwtSecret(addon, httpClient)  {
    const jwtSecret = await getAppProperty(httpClient, "jwtSecret");

    return jwtSecret ? jwtSecret : addon.config.docServer().default.secret;
}

async function getJwtHeader(addon, httpClient) {
    const jwtHeader = await getAppProperty(httpClient, "jwtHeader");

    return jwtHeader ? jwtHeader : addon.config.docServer().default.authorizationHeader
}

async function createQueryToken(addon, clientKey, userAccountId, context) {
    const settings = await addon.settings.get("clientInfo", clientKey);

    return jwt.encodeSymmetric(
        {
            clientKey: clientKey,
            userId: userAccountId,
            pageId: context.pageId,
            attachmentId: context.attachmentId,
            operation: context.operation
        },
        settings.sharedSecret
    );
}

async function verifyQueryToken(addon, token, operation) {

    const unverifiedContext = jwt.decodeSymmetric(token, "", jwt.SymmetricAlgorithm.HS256, true);

    const settings = await addon.settings.get("clientInfo", unverifiedContext.clientKey);

    const context = jwt.decodeSymmetric(token, settings.sharedSecret, jwt.SymmetricAlgorithm.HS256);

    if (!context.userId || !context.pageId || !context.attachmentId || !context.operation) {
        return Promise.reject({
            message: "Token did not contain required parameters"
        })
    }

    if (context.operation !== operation) {
        return Promise.reject({
            message: "Not supported operation"
        })
    }

    return context;
}

module.exports = {
    getJwtSecret,
    getJwtHeader,
    createQueryToken,
    verifyQueryToken
};