import dotenv from 'dotenv'
dotenv.config({
    path:"./.env"
})
import { ConnectDB } from './db/db.js'
import {app} from './app.js'
const port = process.env.PORT || 3000


ConnectDB().then(()=>{
    app.listen(port,()=>{
        console.log(`Your server running on ${port} port`)
    })
}).catch((error)=>{
    console.log(`MongoDB Connection Failed`,error)
})