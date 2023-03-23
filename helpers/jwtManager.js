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