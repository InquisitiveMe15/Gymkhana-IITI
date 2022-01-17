const express = require('express')
const passport = require('passport')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const app = express()
const path = require('path')
const mongoose = require('mongoose')
require('dotenv').config()
const cookieSession = require("cookie-session");


const DB_URI = process.env.MONGO_URI
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN
const CLIENT_URL = process.env.CLIENT_URL

require('./passport-setup')
const Users = require('./models/users')

app.use(
  cookieSession({ name: "session", keys: ["lama"], maxAge: 24 * 60 * 60 * 100 })
);

app.use(cookieParser())
app.use(passport.initialize())
app.use(passport.session());
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }))
app.use(express.json({ limit: '50mb' }))

app.set("trust proxy", 1);

const cloudinary = require('cloudinary').v2
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

mongoose.connect(DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(res => console.log('mongoDB connected...'))
  .catch(err => console.log(err))

app.get('/', (req, res) => {
  res.status(200).json({
    msg: "This is the server of Gymkhana IITI"
  })
})

app.get("/login/success", (req, res) => {
  res.send(req.user);
});

app.get("/logout", (req, res) => {
  res.cookie('user','false',{secure:true})
  req.logout();
  res.redirect(CLIENT_URL);
});

app.get("/google", passport.authenticate("google", { scope: ['email','profile'] }));

app.get("/google/callback",
    passport.authenticate('google', {failureRedirect: CLIENT_URL,session:true}),
    function (req,res){
      console.log("Authenticated Successfully")
      const email = req.user.emails[0].value
      console.log("Email in callback",email)
      res.cookie('user', email,{secure:true})
      res.redirect(CLIENT_URL)
    }
);

const usersRoute = require('./routes/users')
app.use('/users', usersRoute)

const contentRoute = require('./routes/content')
app.use('/content', contentRoute)

app.route('/uploadImage').post(async (req, res) => {
  try {
    let imgData  = req.body.img
    imgData = JSON.parse(imgData)
    const imgString = imgData.data

    const dataFor = req.body.dataFor

    const uploadResponse = await cloudinary.uploader.upload(imgString);
    const imgURL = uploadResponse.secure_url

    let userName = req.body.userName

    let user = await Users.findOne({userName:userName})
    const versionIndex = (user.contentVersions).length - 1;

    if(dataFor=="poster")
    {
        user = await Users.updateOne({userName:userName},{'$set': { [`contentVersions.${versionIndex}.homePagePoster.src`] : imgURL}},{new:true})
    }
    else if(dataFor=="logo")
    {
        user = await Users.updateOne({userName:userName},{'$set': { [`contentVersions.${versionIndex}.userDetails.logo`] : imgURL}},{new:true})
    }
    else if(dataFor=="editSectionChild")
    {
        const sectionID = req.body.sectionID
        const sectionChildID = req.body.sectionChildID
        let allSections = user.contentVersions[versionIndex].Sections;
        let sectionIndex = allSections.findIndex((element) => element.sectionID === parseInt(sectionID));
        let sectionContent = allSections[sectionIndex].sectionContent;
        let sectionChildIndex = sectionContent.findIndex((element) => element.sectionChildID === parseInt(sectionChildID))
        user = await Users.updateOne({userName:userName},{'$set': { [`contentVersions.${versionIndex}.Sections.${sectionIndex}.sectionContent.${sectionChildIndex}.sectionChildImage`] : imgURL}},{new:true})
    }

    res.json({ msg: 'success' });
  } catch (error) {
    console.log(error)
    res.status(500).json({ err: 'Something went wrong' });
  }
})


app.listen(PORT, () => {
  console.log("CLIENT ORIGIN IS ",CLIENT_ORIGIN)
  console.log("CLIENT URL IS ",CLIENT_URL)
  console.log(`Listening on the port: ${PORT}`);
});
