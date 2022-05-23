const axios = require("axios");

function getAppProperty(httpClient, propertyKey) {
    return new Promise((resolve, reject) => {
        httpClient.get({
            url: `/rest/atlassian-connect/1/addons/onlyoffice-confluence-cloud/properties/${propertyKey}`,
            json: true
        }, function(err, response, body) {
            if (err) {
                reject(err);
                return;
            }

            if (body.value === undefined || body.value == "") {
                resolve(null);
            }

            resolve(body.value);
        });
    });
}

function setAppProperty(httpClient, propertyKey, value) {
    return new Promise((resolve, reject) => {
        httpClient.put({
            url: `/rest/atlassian-connect/1/addons/onlyoffice-confluence-cloud/properties/${propertyKey}`,
            json: value
        }, function(err, response, body) {
            if (err) {
                reject(err);
                return;
            }
        });
    });
}

function getAttachmentInfo(httpClient, pageId, attachmentId) {
    return new Promise((resolve, reject) => {
        // make sure the content ID is valid to prevent traversal
        if (!/^[A-Z0-9-]+$/i.test(pageId)) {
            reject(new Error("Invalid content ID"));
            return;
        }

        httpClient.get({
            url: `/rest/api/content/${pageId}/child/attachment?expand=history.lastUpdated,container`,
            json: true
        }, function(err, response, body) {
            if (err) {
                reject(err);
                return;
            }

            for(var i in body.results) {
                if (body.results[i].id == "att" + attachmentId) {
                    resolve(body.results[i]);
                }
            }

            resolve(null); //ToDo: check not null
        });
    });
}

function getUserInfo(httpClient, userAccountId) {
    return new Promise((resolve, reject) => {
        httpClient.get({
            url: `/rest/api/user?accountId=${userAccountId}`,
            json: true
        }, function(err, response, body) {
            if (err) {
                reject(err);
                return;
            }

            resolve(body);
        })
    });
}

function checkPermissions(httpClient, accountId, contentId, operation) {
    return new Promise((resolve, reject) => {
        // make sure the content ID is valid to prevent traversal
        if (!/^[A-Z0-9-]+$/i.test(contentId)) {
            reject(new Error("Invalid content ID"));
            return;
        }

        httpClient.asUserByAccountId(accountId).post({
            url: `/rest/api/content/${encodeURIComponent(contentId)}/permission/check`,
            headers: {
                "X-Atlassian-Token": "no-check"
            },
            json: {
                subject: {
                    type: "user",
                    identifier: accountId
                },
                operation
            }
        }, function (err, httpResponse, body) {
            if (err) {
                reject(err);
                return;
            }

            if (body.errors && body.errors.length > 0) {
                reject(body.errors);
                return;
            }

            resolve(body.hasPermission);
        });
    });
}

function updateContent(httpClient, userAccountId, pageId, attachmentId, fileData) {
    return new Promise((resolve, reject) => {
        httpClient.asUserByAccountId(userAccountId).post({
            headers: {
                "X-Atlassian-Token": "no-check",
                "Accept": "application/json"
            },
            multipartFormData: {
                file: [fileData],
            },
            url: `/rest/api/content/${pageId}/child/attachment/${attachmentId}/data`
        }, function(err, response, body) {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

function getUriDownloadAttachment(httpClient, pageId, attachmentId) {
    return new Promise((resolve, reject) => {
        httpClient.get({
            url: `/rest/api/content/${pageId}/child/attachment/${attachmentId}/download`
        }, function(err, response, body) {
            if (err) {
                reject(err);
                return;
            }

            resolve(response.request.uri.href);
        });
    });
}

async function getFileDataFromUrl(url) {
    const file = await axios({
        method: "get",
        responseType: "arraybuffer",
        headers: {
          'Content-Type': 'application/json'
        },
        url: url,
    });

    return file.data; //ToDo : check exception
}

module.exports = {
    getAppProperty,
    setAppProperty,
    getAttachmentInfo,
    getUserInfo,
    checkPermissions,
    updateContent,
    getUriDownloadAttachment,
    getFileDataFromUrl
};