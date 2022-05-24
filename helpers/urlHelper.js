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

    return localBaseUrl + "onlyoffice-download?token=" + token;
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

    return localBaseUrl + "onlyoffice-callback?token=" + token;
}

urlHelper.getGoBackUrl = function (hostBaseUrl, pageId) {
    var url = hostBaseUrl + "/pages/viewpageattachments.action";
    url = url + "?pageId=" + pageId;
    return url;
}

urlHelper.getDocApiUrl = async function (addon, httpClient) {
    const docApiUrl = await getAppProperty(httpClient, "docApiUrl");

    return docApiUrl ? docApiUrl : addon.config.docServer().default.adress;
}

module.exports = urlHelper;