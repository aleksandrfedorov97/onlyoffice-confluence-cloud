const {
    getAppProperty
} = require("./requestHelper.js");

var urlHelper = {};

urlHelper.getFileUrl = function (localBaseUrl, clientKey, pageId, attachmentId) {
    var url = localBaseUrl + "onlyoffice-download";
    url = url + "?clientKey=" + clientKey;
    url = url + "&pageId=" + pageId;
    url = url + "&attachmentId=" + attachmentId;
    return url;
}

urlHelper.getCallbackUrl = function (localBaseUrl, clientKey, pageId, attachmentId) {
    var url = localBaseUrl + "onlyoffice-callback";
    url = url + "?clientKey=" + clientKey;
    url = url + "&pageId=" + pageId;
    url = url + "&attachmentId=" + attachmentId;
    return url;
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