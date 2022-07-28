/*
* (c) Copyright Ascensio System SIA 2022
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

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

function appendSlash(url) {
    return url.replace(/\/$|$/, '/');
}

module.exports = urlHelper;