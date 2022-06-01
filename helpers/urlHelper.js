const {
    getAppProperty
} = require("./requestHelper.js");

const {
    createQueryToken
} = require("../helpers/jwtManager.js");

var urlHelper = {};

urlHelper.getFileUrl = async function (addon, localBaseUrl, clientKey, userAccountId, pageId, attachmentId) {

    const token = await createQueryToken(
        addon,
        clientKey,
        userAccountId,
        {
            pageId: pageId,
            attachmentId: attachmentId,
            operation: "download"
        }
    );

    return appendSlash(localBaseUrl) + "onlyoffice-download?token=" + token;
}

urlHelper.getCallbackUrl = async function (addon, localBaseUrl, clientKey, userAccountId, pageId, attachmentId) {

    const token = await createQueryToken(
        addon,
        clientKey,
        userAccountId,
        {
            pageId: pageId,
            attachmentId: attachmentId,
            operation: "callback"
        }
    );

    return appendSlash(localBaseUrl) + "onlyoffice-callback?token=" + token;
}

urlHelper.getGoBackUrl = function (hostBaseUrl, pageId) {
    var url = appendSlash(hostBaseUrl) + "pages/viewpageattachments.action";
    url = url + "?pageId=" + pageId;
    return url;
}

urlHelper.getDocApiUrl = async function (addon, httpClient) {
    const docApiUrl = await getAppProperty(httpClient, "docApiUrl");

    return appendSlash(docApiUrl || addon.config.docServer().default.adress);
}

function appendSlash (url) {
    return url.replace(/\/$|$/, '/');
}

module.exports = urlHelper;