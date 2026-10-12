-- Alias/wrapper so require("json") points directly to main.lua
local main = require("extensions.x4_supply_matrix.lua.main") or require("main")
return main
