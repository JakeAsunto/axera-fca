# Before:
```js
defaultFuncs
  .post("https://www.facebook.com/messaging/send/", ctx.jar, form)
  .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
  .then(function (resData) {
    if (!resData) {
      throw new utils.CustomError({ error: "Add to group failed." });
    }
    if (resData.error) {
      throw new utils.CustomError(resData);
    }

    return callback();
  })
  .catch(function (err) {
    utils.error("addUserToGroup", err);
    return callback(err);
  });
```
# After:
```js
function handler(resData) {
  if (!resData) {
    throw new utils.CustomError({ error: "Add to group failed." });
  }
  if (resData.error) {
    throw new utils.CustomError(resData);
  }

  return callback(); // Successfully added to group, no errors.
}

function errorHandler(err) {
  utils.error("addUserToGroup", err);
  return callback(err);
}

async function addUserToGroup(userID, threadID, callback) {
  try {
    const res = apiClient.post("/messaging/send/", { cookieJar, formData })
    const resData = utils.parseAndCheckLogin(ctx, defaultFuncs)(res)
    await handler(resData)
  } catch (error) {
    utils.logError(error)
    throw new Error(error)
  }
}
```