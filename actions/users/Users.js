if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}
var auth0 = new auth0.WebAuth({
  domain: process.env.AUTH0_DOMAIN,
  clientID: rocess.env.AUTH0_CLIENT_ID,
});
const firebase = require("../../firebase/firebaseInit");

module.exports = {
  findGoogleUserByToken: async function (accessToken) {
    var userInfo;
    auth0.client.userInfo(accessToken, function (err, user) {
      if (err) {
        console.log("Error in findGoogleUserByToken: " + err);
      } else {
        userInfo = user;
        console.log(userInfo);
      }
    });
    return userInfo;
  },
  findFirebaseUser: async function (id, platform) {
    const userDoc = firebase.db.collection("users");
    if (platform == "facebook" && id) {
      //Return User By messengerID
      try {
        const snapshot = await userDoc.where("google_sub", "==", id).get();
        var firebaseUser;
        snapshot.forEach((doc) => {
          firebaseUser = doc.data();
        });
        return firebaseUser;
      } catch (err) {
        console.log("User error" + err);
        return Promise.reject("No such document");
      }
    } else if (platform == "google" && id) {
      try {
        const snapshot = await userDoc.where("google_sub", "==", id).get();
        var firebaseUser;
        snapshot.forEach((doc) => {
          firebaseUser = doc.data();
        });
        return firebaseUser;
      } catch (err) {
        console.log("User error" + err);
        return Promise.reject("No such document");
      }
    }
  },
};
