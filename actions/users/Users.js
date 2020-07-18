if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}
const axios = require("axios");

// const auth0 = require("auth0-js")
// var auth_0 = new auth0.Authentication({
//   domain: process.env.AUTH0_DOMAIN,
//   clientID: process.env.AUTH0_CLIENT_ID,
// });
const firebase = require("../../firebase/firebaseInit");

module.exports = {
  findGoogleUserByToken: async function (accessToken) {
    console.log("findGoogleUserByToken: " + accessToken);
    var userInfo;

  return  axios
      .post(
        `https://${process.env.AUTH0_DOMAIN}/userinfo`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )
      .then((res) => {
        console.log(res.data);
        userInfo = res.data;
        return userInfo
      })
      .catch((error) => {
        console.error(error);
      });
    //return userInfo;
  },
  // findGoogleUserByToken: async function (accessToken) {
  //   console.log("findGoogleUserByToken: "+accessToken)

  //   var userInfo;
  //   auth_0.setCredentials({access_token: accessToken});

  //   oauth2.userinfo.get(
  //     function(err, res) {
  //       if (err) {
  //          console.log(err);
  //       } else {
  //          console.log(res);
  //          userInfo = res
  //       }

  //   });
  //   return userInfo;
  // },
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
