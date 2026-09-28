local JSON
local ok, mod = pcall(require, "json")
if ok and mod then
    JSON = mod
else
    local ok2, mod2 = pcall(require, "main")
    if ok2 and mod2 then
        JSON = mod2
    else
        JSON = require("extensions.x4_supply_matrix.lua.main")
    end
end
local Request = require("djfhe.http.request") 

local function RegisterEncyclopediaListener()
    -- Intercept the custom event thrown by the MD script
    RegisterEvent("X4_Export_Encyclopedia", function(eventName, payloadTable)
        if not payloadTable then return end

        local blueprintPayload = {
            dataType = "encyclopedia_blueprints",
            blueprints = {}
        }

        -- Convert MD table structures into predictable Lua tables
        for wareId, metrics in pairs(payloadTable) do
            -- Safely fall back to UI-layer string lookups if name is a raw engine handle
            local cleanName = type(metrics.name) == "userdata" and ReadText(metrics.name) or tostring(metrics.name or wareId)
            local cleanDesc = type(metrics.description) == "userdata" and ReadText(metrics.description) or tostring(metrics.description or "")

            -- Extract production details if present
            local prodData = {
                cycleTime = 0,
                output = "",
                amount = 0,
                inputs = {}
            }
            if type(metrics.production) == "table" then
                prodData.cycleTime = tonumber(metrics.production.cycleTime) or 0
                prodData.output = tostring(metrics.production.output or "")
                prodData.amount = tonumber(metrics.production.amount) or 0
                if type(metrics.production.inputs) == "table" then
                    for _, inItem in pairs(metrics.production.inputs) do
                        if type(inItem) == "table" then
                            table.insert(prodData.inputs, {
                                ware = tostring(inItem.ware or ""),
                                amount = tonumber(inItem.amount) or 0
                            })
                        end
                    end
                end
            end

            -- Extract habitation details if present
            local habData = {
                race = "All",
                maxCapacity = 0
            }
            if type(metrics.habitation) == "table" then
                habData.race = tostring(metrics.habitation.race or "All")
                habData.maxCapacity = tonumber(metrics.habitation.maxCapacity) or 0
            end

            -- Extract storage details if present
            local storeData = {
                capacity = 0,
                tags = ""
            }
            if type(metrics.storage) == "table" then
                storeData.capacity = tonumber(metrics.storage.capacity) or 0
                storeData.tags = tostring(metrics.storage.tags or "")
            end

            table.insert(blueprintPayload.blueprints, {
                id = tostring(wareId),
                name = cleanName,
                description = cleanDesc,
                category = tostring(metrics.category or ""),
                moduleType = tostring(metrics.moduleType or "Structural"),
                hull = tonumber(metrics.hull) or 100000,
                production = prodData,
                habitation = habData,
                storage = storeData,
                macro = tostring(metrics.macro or "")
            })
        end

        -- Transmit to Node.js backend
        local jsonString = JSON.encode(blueprintPayload)
        Request.new('POST')
            :setUrl("http://localhost:3000/api/encyclopedia")
            :setBody(jsonString)
            :addHeader("Content-Type", "application/json")
            :send(function(response, err)
                if err then 
                    DebugError("Failed to export encyclopedia data: " .. tostring(err)) 
                end
            end)
    end)
end

local function RegisterPlayerListener()
    -- Intercept custom event for player telemetry data
    RegisterEvent("X4_Export_Player", function(eventName, payloadTable)
        if not payloadTable then return end

        local playerPayload = {
            player = {
                name = type(payloadTable.name) == "userdata" and ReadText(payloadTable.name) or tostring(payloadTable.name or "Unknown"),
                credits = tonumber(payloadTable.credits) or 0,
                sector = type(payloadTable.sector) == "userdata" and ReadText(payloadTable.sector) or tostring(payloadTable.sector or "Unknown")
            }
        }

        local jsonString = JSON.encode(playerPayload)
        Request.new('POST')
            :setUrl("http://localhost:3000/api/update")
            :setBody(jsonString)
            :addHeader("Content-Type", "application/json")
            :send(function(response, err)
                if err then
                    DebugError("Failed to export player data: " .. tostring(err))
                end
            end)
    end)
end

-- Process incoming commands dispatched from the companion dashboard
local function ProcessCommand(cmd)
    if not cmd or type(cmd) ~= "table" then return end
    local targetTable = tostring(cmd.table or "blueprints")
    DebugError("[X4 Bridge] Processing dashboard request for table: " .. targetTable)

    -- Trigger Mission Director harvesting cue
    if AddUITriggeredEvent then
        AddUITriggeredEvent("X4_Request_Update", targetTable)
    elseif RaiseLuaEvent then
        RaiseLuaEvent("X4_Request_Update", { table = targetTable })
    elseif RaiseGameUIEvent then
        RaiseGameUIEvent("X4_Request_Update", targetTable)
    end
end

-- Poll the Node.js backend for pending commands requested from the UI
local function PollBackendCommands()
    Request.new('GET')
        :setUrl("http://localhost:3000/api/commands")
        :send(function(response, err)
            if err or not response or not response.body then return end
            if JSON and JSON.decode then
                local ok, data = pcall(JSON.decode, response.body)
                if ok and data and type(data.commands) == "table" then
                    for _, cmd in ipairs(data.commands) do
                        ProcessCommand(cmd)
                    end
                end
            end
        end)
end

RegisterEncyclopediaListener()
RegisterPlayerListener()

-- Register command polling hook
if RegisterEvent then
    RegisterEvent("game_loop", PollBackendCommands)
    RegisterEvent("onUpdate", PollBackendCommands)
end
