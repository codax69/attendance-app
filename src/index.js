import ConnectDB from './db/db.js'
import dotenv from 'dotenv'
import {app} from './app.js'
dotenv.config({
    path:"./.env"
})
const port = process.env.PORT || 3000


app.get("/",(req,res)=>{
   res.send("web Is Healthy...!")
})

ConnectDB().then(()=>{
    app.listen(port,()=>{
        console.log(`Your server running on ${port} port`)
    })
}).catch((error)=>{
    console.log(`MongoDB Connection Failed`,error)
})