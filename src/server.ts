import {http}from "./http";
import "./webSocket/client"
import "./webSocket/admin"

http.listen(3333, () => console.log("Father It's ON"));