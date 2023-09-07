/*
* (c) Copyright Ascensio System SIA 2023
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

const urlHelper = require("./urlHelper.js");
const requestHelper = require("./requestHelper.js");

var documentHelper = {};

const SUPPORTED_FORMATS = {
    "djvu": {"type": "word"},
    "doc": {"type": "word"},
    "docm": {"type": "word"},
    "docx": {"type": "word", "edit": true},
    "dot": {"type": "word"},
    "dotm": {"type": "word"},
    "dotx": {"type": "word"},
    "epub": {"type": "word"},
    "fb2": {"type": "word"},
    "fodt": {"type": "word"},
    "html": {"type": "word"},
    "mht": {"type": "word"},
    "odt": {"type": "word"},
    "ott": {"type": "word"},
    "oxps": {"type": "word"},
    "pdf": {"type": "word"},
    "rtf": {"type": "word"},
    "txt": {"type": "word"},
    "xps": {"type": "word"},
    "xml": {"type": "word"},

    "csv": {"type": "cell"},
    "fods": {"type": "cell"},
    "ods": {"type": "cell"},
    "ots": {"type": "cell"},
    "xls": {"type": "cell"},
    "xlsm": {"type": "cell"},
    "xlsx": {"type": "cell", "edit": true},
    "xlt": {"type": "cell"},
    "xltm": {"type": "cell"},
    "xltx": {"type": "cell"},

    "fodp": {"type": "slide"},
    "odp": {"type": "slide"},
    "otp": {"type": "slide"},
    "pot": {"type": "slide"},
    "potm": {"type": "slide"},
    "potx": {"type": "slide"},
    "pps": {"type": "slide"},
    "ppsm": {"type": "slide"},
    "ppsx": {"type": "slide"},
    "ppt": {"type": "slide"},
    "pptm": {"type": "slide"},
    "pptx": {"type": "slide", "edit": true}
};

documentHelper.getFileExtension = function (fileName) {
    var parts = fileName.toLowerCase().split(".");

    return parts.pop();
}

documentHelper.getDocumentType = function (extension) {
    if (SUPPORTED_FORMATS[extension] !== undefined) {
        return SUPPORTED_FORMATS[extension]["type"];
    }

    return null;
}

documentHelper.isEditable = function (extension) {
    return SUPPORTED_FORMATS[extension] !== undefined && SUPPORTED_FORMATS[extension]["edit"] === true;
}

documentHelper.getDocumentKey = function (attachmentId, updateTime) {
    
    return Buffer.from(attachmentId + "_" + Date.parse(updateTime)).toString('base64');
}

documentHelper.getEditorConfig = async function (addon, httpClient, clientKey, localBaseUrl, hostBaseUrl, attachmentInfo, userInfo) {

    const fileType = documentHelper.getFileExtension(attachmentInfo.title);
    let mode = "view";
    let callbackUrl = null;

    let permissionEdit = await requestHelper.checkContentPermission(httpClient, userInfo.accountId, attachmentInfo.id, "update");

    if (permissionEdit && documentHelper.isEditable(fileType)) {
        mode = "edit";
        callbackUrl = await urlHelper.getCallbackUrl(addon, localBaseUrl, clientKey, userInfo.accountId, attachmentInfo.pageId || attachmentInfo.blogPostId, attachmentInfo.id);
    }

    return {
        type: "desktop",
        width: "100%",
        height: "100%",
        documentType: documentHelper.getDocumentType(fileType),
        document: {
            title: attachmentInfo.title,
            url: await urlHelper.getFileUrl(addon, localBaseUrl, clientKey, userInfo.accountId, attachmentInfo.pageId || attachmentInfo.blogPostId, attachmentInfo.id),
            fileType: fileType,
            key: documentHelper.getDocumentKey(attachmentInfo.id, attachmentInfo.version.createdAt),
            info: {
                uploaded: attachmentInfo.version.createdAt
            },
            permissions: {
                edit: permissionEdit,
            },
            referenceData: {
                fileKey: attachmentInfo.id,
                instanceId: clientKey
            }
        },
        editorConfig: {
            callbackUrl: callbackUrl,
            mode: mode,
            lang: "en",
            user: {
                id: userInfo.accountId,
                name: userInfo.displayName
            },
            customization: {
                goback: {
                    url: urlHelper.getGoBackUrl(hostBaseUrl, attachmentInfo.pageId || attachmentInfo.blogPostId)
                }
            }
        }
    };
}

module.exports = documentHelper;