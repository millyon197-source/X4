local JSON = require("json")
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
            local cleanName = type(metrics.name) == "userdata" and ReadText(metrics.name) or tostring(metrics.name)
            local cleanDesc = type(metrics.description) == "userdata" and ReadText(metrics.description) or tostring(metrics.description)

            table.insert(blueprintPayload.blueprints, {
                id = tostring(wareId),
                name = cleanName,
                description = cleanDesc,
                category = tostring(metrics.category),
                productionTime = tonumber(metrics.productionTime) or 0,
                macro = tostring(metrics.macro)
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

RegisterEncyclopediaListener()
