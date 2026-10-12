--[[
    X4 Foundations Companion Bridge
    Bidirectional bridge between X4 Foundations and Companion Dashboard (Node.js)
--]]

-- Ensure extension paths are registered in Lua package.path
if package and package.path then
    if not string.find(package.path, "extensions/x4_companion_bridge/lua/?.lua", 1, true) then
        package.path = package.path .. ";extensions/x4_companion_bridge/lua/?.lua"
    end
    if not string.find(package.path, "extensions/djfhe_http/lua/?.lua", 1, true) then
        package.path = package.path .. ";extensions/djfhe_http/lua/?.lua"
    end
end

-- =========================================================================
-- Self-Contained JSON Engine (Encode / Decode)
-- =========================================================================
local JSON = {}

local function json_escape(s)
    local matches = {
        ['\\'] = '\\\\', ['"'] = '\\"', ['\b'] = '\\b',
        ['\f'] = '\\f', ['\n'] = '\\n', ['\r'] = '\\r', ['\t'] = '\\t'
    }
    return string.gsub(s, '["\\\b\f\n\r\t]', matches)
end

local function is_array_table(t)
    if getmetatable(t) and getmetatable(t).__jsontype == "array" then
        return true
    end
    local count = 0
    for k, _ in pairs(t) do
        count = count + 1
        if type(k) ~= "number" or k <= 0 or math.floor(k) ~= k then
            return false
        end
    end
    for i = 1, count do
        if t[i] == nil then return false end
    end
    return count > 0
end

function JSON.array(t)
    t = t or {}
    return setmetatable(t, { __jsontype = "array" })
end

function JSON.encode(val)
    local t = type(val)
    if t == "table" then
        if is_array_table(val) or (getmetatable(val) and getmetatable(val).__jsontype == "array") then
            local res = {}
            for _, v in ipairs(val) do
                table.insert(res, JSON.encode(v))
            end
            return "[" .. table.concat(res, ",") .. "]"
        else
            local res = {}
            for k, v in pairs(val) do
                table.insert(res, '"' .. json_escape(tostring(k)) .. '":' .. JSON.encode(v))
            end
            return "{" .. table.concat(res, ",") .. "}"
        end
    elseif t == "string" then
        return '"' .. json_escape(val) .. '"'
    elseif t == "number" then
        if val ~= val or val == math.huge or val == -math.huge then
            return "null"
        end
        return tostring(val)
    elseif t == "boolean" then
        return tostring(val)
    else
        return "null"
    end
end

function JSON.decode(str)
    if type(str) ~= "string" or #str == 0 then return nil end
    local pos = 1
    local len = #str

    local function skip_whitespace()
        while pos <= len and string.find(" \t\r\n", string.sub(str, pos, pos), 1, true) do
            pos = pos + 1
        end
    end

    local function parse_val()
        skip_whitespace()
        if pos > len then return nil end
        local c = string.sub(str, pos, pos)

        if c == '"' then
            pos = pos + 1
            local s = ""
            while pos <= len do
                local ch = string.sub(str, pos, pos)
                if ch == '"' then
                    pos = pos + 1
                    return s
                elseif ch == '\\' then
                    pos = pos + 1
                    local esc = string.sub(str, pos, pos)
                    if esc == 'n' then s = s .. '\n'
                    elseif esc == 'r' then s = s .. '\r'
                    elseif esc == 't' then s = s .. '\t'
                    elseif esc == '\\' then s = s .. '\\'
                    elseif esc == '"' then s = s .. '"'
                    else s = s .. esc end
                else
                    s = s .. ch
                end
                pos = pos + 1
            end
            return s
        elseif c == '{' then
            pos = pos + 1
            local obj = {}
            skip_whitespace()
            if string.sub(str, pos, pos) == '}' then
                pos = pos + 1
                return obj
            end
            while pos <= len do
                skip_whitespace()
                local key = parse_val()
                skip_whitespace()
                if string.sub(str, pos, pos) == ':' then
                    pos = pos + 1
                end
                skip_whitespace()
                local val = parse_val()
                obj[key] = val
                skip_whitespace()
                local next_c = string.sub(str, pos, pos)
                if next_c == '}' then
                    pos = pos + 1
                    return obj
                elseif next_c == ',' then
                    pos = pos + 1
                end
            end
            return obj
        elseif c == '[' then
            pos = pos + 1
            local arr = {}
            skip_whitespace()
            if string.sub(str, pos, pos) == ']' then
                pos = pos + 1
                return arr
            end
            while pos <= len do
                skip_whitespace()
                local val = parse_val()
                table.insert(arr, val)
                skip_whitespace()
                local next_c = string.sub(str, pos, pos)
                if next_c == ']' then
                    pos = pos + 1
                    return arr
                elseif next_c == ',' then
                    pos = pos + 1
                end
            end
            return arr
        elseif string.find("0123456789-", c, 1, true) then
            local num_str = string.match(str, "^[%-%d%.eE%+]+", pos)
            pos = pos + #num_str
            return tonumber(num_str)
        elseif string.sub(str, pos, pos + 3) == "true" then
            pos = pos + 4
            return true
        elseif string.sub(str, pos, pos + 4) == "false" then
            pos = pos + 5
            return false
        elseif string.sub(str, pos, pos + 3) == "null" then
            pos = pos + 4
            return nil
        else
            pos = pos + 1
            return nil
        end
    end

    return parse_val()
-- =========================================================================
-- Direct C/FFI Engine Bindings & String Converters
-- =========================================================================
local ffi = nil
pcall(function() ffi = require("ffi") end)

local C = nil
if ffi then
    pcall(function()
        C = ffi.C
        ffi.cdef[[
            typedef struct {
                const char* ware;
                const char* productionmethodid;
            } UIBlueprint;
            uint32_t GetNumBlueprints(const char* set, const char* category, const char* macroname);
            uint32_t GetBlueprints(UIBlueprint* result, uint32_t resultlen, const char* set, const char* category, const char* macroname);
        ]]
    end)
end
if not C and _G and _G.C then
    C = _G.C
end

local cachedPlayerSector = nil
local cachedPlayerName = nil

local function cdataOrStringToLua(val)
    if val == nil then return nil end
    local t = type(val)
    if t == "string" then
        if val:find("^cdata") then return nil end
        return val
    elseif t == "cdata" then
        local ok, s = pcall(function()
            if ffi and ffi.string then
                return ffi.string(val)
            end
        end)
        if ok and s and #s > 0 then
            return s
        end
        return nil
    elseif t == "userdata" and ReadText then
        local ok, s = pcall(ReadText, val)
        if ok and s then return tostring(s) end
    end
    local s = tostring(val)
    if s:find("^cdata") then
        return nil
    end
    return s
end

-- =========================================================================
-- HTTP Request Module Resolver
-- =========================================================================
local Request = nil
local function getRequest()
    if Request then return Request end
    local ok, mod = pcall(require, "djfhe.http.request")
    if ok and mod then
        Request = mod
        return Request
    end
    -- Fallback: try relative require
    local ok2, mod2 = pcall(require, "extensions.djfhe_http.lua.djfhe.http.request")
    if ok2 and mod2 then
        Request = mod2
        return Request
    end
    if DebugError then
        DebugError("[X4 Companion Bridge] Notice: djfhe.http.request not ready: " .. tostring(mod))
    end
    return nil
end

-- =========================================================================
-- Telemetry & Blueprint Exporters
-- =========================================================================
local function logBridge(msg)
    pcall(function()
        if DebugError then DebugError("[X4 Companion Bridge] " .. tostring(msg)) end
        local req = getRequest()
        if req then
            req.new('POST')
                :setUrl("http://127.0.0.1:3000/api/debug-log")
                :setBody(JSON.encode({ message = tostring(msg) }))
                :addHeader("Content-Type", "application/json")
                :send(function() end)
        end
    end)
end

local function RegisterEncyclopediaListener()
    if not RegisterEvent then return end

    RegisterEvent("X4_Export_Encyclopedia", function(eventName, payloadTable)
        if not payloadTable and type(eventName) == "table" then
            payloadTable = eventName
        end
        if not payloadTable then return end
        local req = getRequest()
        if not req then return end

        logBridge("X4_Export_Encyclopedia event received from MD!")
        local targetTable = "modules"
        local itemsTable = payloadTable
        if type(payloadTable) == "table" then
            if payloadTable.table or payloadTable["$table"] then
                targetTable = tostring(payloadTable.table or payloadTable["$table"])
            end
            if payloadTable.items or payloadTable["$items"] then
                itemsTable = payloadTable.items or payloadTable["$items"]
            end
        end

        local blueprintPayload = {
            dataType = "encyclopedia_blueprints",
            table = targetTable,
            blueprints = {}
        }

        for wareId, metrics in pairs(itemsTable) do
            local rawName = metrics.name or metrics["$name"]
            local cleanName = cdataOrStringToLua(rawName) or tostring(wareId)
            local rawDesc = metrics.description or metrics["$description"]
            local cleanDesc = cdataOrStringToLua(rawDesc) or ""

            local prodRaw = metrics.production or metrics["$production"]
            local prodData = {
                cycleTime = 0,
                output = "",
                amount = 0,
                inputs = {}
            }
            if type(prodRaw) == "table" then
                prodData.cycleTime = tonumber(prodRaw.cycleTime or prodRaw["$cycleTime"]) or 0
                prodData.output = tostring(prodRaw.output or prodRaw["$output"] or "")
                prodData.amount = tonumber(prodRaw.amount or prodRaw["$amount"]) or 0
                local inList = prodRaw.inputs or prodRaw["$inputs"]
                if type(inList) == "table" then
                    for _, inItem in pairs(inList) do
                        if type(inItem) == "table" then
                            table.insert(prodData.inputs, {
                                ware = tostring(inItem.ware or inItem["$ware"] or ""),
                                amount = tonumber(inItem.amount or inItem["$amount"]) or 0
                            })
                        end
                    end
                end
            end

            local habRaw = metrics.habitation or metrics["$habitation"]
            local habData = {
                race = "All",
                maxCapacity = 0
            }
            if type(habRaw) == "table" then
                habData.race = tostring(habRaw.race or habRaw["$race"] or "All")
                habData.maxCapacity = tonumber(habRaw.maxCapacity or habRaw["$maxCapacity"]) or 0
            end

            local storeRaw = metrics.storage or metrics["$storage"]
            local storeData = {
                capacity = 0,
                tags = ""
            }
            if type(storeRaw) == "table" then
                storeData.capacity = tonumber(storeRaw.capacity or storeRaw["$capacity"]) or 0
                storeData.tags = tostring(storeRaw.tags or storeRaw["$tags"] or "")
            end

            local isUnlocked = (metrics.unlocked == true) or (metrics["$unlocked"] == true) or (metrics.unlocked == 1) or (metrics["$unlocked"] == 1) or false

            table.insert(blueprintPayload.blueprints, {
                id = tostring(wareId),
                name = cleanName,
                description = cleanDesc,
                category = tostring(metrics.category or metrics["$category"] or ""),
                moduleType = tostring(metrics.moduleType or metrics["$moduleType"] or "Structural"),
                group = tostring(metrics.group or metrics["$group"] or targetTable),
                hull = tonumber(metrics.hull or metrics["$hull"]) or 100000,
                production = prodData,
                habitation = habData,
                storage = storeData,
                macro = tostring(metrics.macro or metrics["$macro"] or ""),
                unlocked = isUnlocked
            })
        end

        logBridge("Exporting " .. tostring(#blueprintPayload.blueprints) .. " items for table: " .. targetTable)
        local jsonString = JSON.encode(blueprintPayload)
        req.new('POST')
            :setUrl("http://127.0.0.1:3000/api/encyclopedia")
            :setBody(jsonString)
            :addHeader("Content-Type", "application/json")
            :send(function(response, err)
                if err and DebugError then
                    DebugError("[X4 Companion Bridge] Encyclopedia export error: " .. tostring(err))
                end
            end)
    end)
end

local function RegisterPlayerListener()
    if not RegisterEvent then return end

    RegisterEvent("X4_Export_Player", function(eventName, payloadTable)
        if not payloadTable and type(eventName) == "table" then
            payloadTable = eventName
        end
        if not payloadTable then return end
        local req = getRequest()
        if not req then return end

        local rawName = payloadTable.name or payloadTable["$name"] or "Commander"
        local rawCredits = payloadTable.credits or payloadTable["$credits"] or 0
        local rawSector = payloadTable.sector or payloadTable["$sector"] or "Deep Space"

        local pName = cdataOrStringToLua(rawName) or "Commander"
        local pCredits = tonumber(rawCredits) or 0
        local pSector = cdataOrStringToLua(rawSector) or "Deep Space"

        if (not pName or pName == "Commander" or pName == "Unknown") and cachedPlayerName then
            pName = cachedPlayerName
        elseif pName and pName ~= "Commander" and pName ~= "Unknown" then
            cachedPlayerName = pName
        end

        if (not pSector or pSector == "Deep Space" or pSector == "Unknown") and cachedPlayerSector then
            pSector = cachedPlayerSector
        elseif pSector and pSector ~= "Deep Space" and pSector ~= "Unknown" then
            cachedPlayerSector = pSector
        end

        local playerPayload = {
            player = {
                name = pName,
                credits = pCredits,
                sector = pSector
            }
        }

        local jsonString = JSON.encode(playerPayload)
        req.new('POST')
            :setUrl("http://127.0.0.1:3000/api/update")
            :setBody(jsonString)
            :addHeader("Content-Type", "application/json")
            :send(function(response, err)
                if err and DebugError then
                    DebugError("[X4 Companion Bridge] Player export error: " .. tostring(err))
                end
            end)
    end)
end

local function GetEnginePlayerBlueprints(categoryFilter)
    local ffiObj = ffi
    local cObj = C or (ffiObj and ffiObj.C) or (_G and _G.C)
    if not ffiObj or not cObj then return nil end

    local ok, result = pcall(function()
        if not cObj.GetNumBlueprints or not cObj.GetBlueprints then return nil end

        local cat = categoryFilter
        if cat == "all" or cat == "blueprints" then cat = nil end

        -- Try set = "player" first (standard in X4), then nil, then ""
        local num = cObj.GetNumBlueprints("player", cat, nil)
        local activeSet = "player"
        if not num or num == 0 then
            num = cObj.GetNumBlueprints(nil, cat, nil)
            activeSet = nil
        end
        if not num or num == 0 then
            num = cObj.GetNumBlueprints("", cat or "", "")
            activeSet = ""
        end
        if not num or num == 0 then return {} end

        local bpArray = ffiObj.new("UIBlueprint[?]", num)
        local fetched = cObj.GetBlueprints(bpArray, num, activeSet, cat, nil)
        if (not fetched or fetched == 0) and activeSet == "" then
            fetched = cObj.GetBlueprints(bpArray, num, "", cat or "", "")
        end

        local count = (fetched and fetched > 0) and fetched or num
        local list = {}
        for i = 0, count - 1 do
            if bpArray[i].ware ~= nil then
                local w = ffiObj.string(bpArray[i].ware)
                if w and #w > 0 then
                    table.insert(list, w)
                end
            end
        end
        return list
    end)
    if ok and result and #result > 0 then return result end
    return nil
end

-- =========================================================================
-- Player Telemetry Resolver
-- =========================================================================
local function resolvePlayerTelemetry()
    local pName = cachedPlayerName
    local pCredits = 0
    local pSector = cachedPlayerSector or "Deep Space"

    -- 1. Try resolving Player Name via standard X4 C-API / Lua
    pcall(function()
        if GetPlayerID and GetComponentName then
            local pid = GetPlayerID()
            if pid then
                local str = cdataOrStringToLua(GetComponentName(pid))
                if str and str ~= "" then pName = str end
            end
        end
        if (not pName or pName == "") and C and C.GetPlayerID and C.GetComponentName then
            local pid = C.GetPlayerID()
            if pid then
                local str = cdataOrStringToLua(C.GetComponentName(pid))
                if str and str ~= "" then pName = str end
            end
        end
        if (not pName or pName == "") and GetPlayerName then
            local str = cdataOrStringToLua(GetPlayerName())
            if str and str ~= "" then pName = str end
        end
        if (not pName or pName == "") and C and C.GetPlayerName then
            local str = cdataOrStringToLua(C.GetPlayerName())
            if str and str ~= "" then pName = str end
        end
    end)

    if pName and pName ~= "" and not pName:find("^cdata:") and pName ~= "Unknown" then
        cachedPlayerName = pName
    else
        pName = cachedPlayerName or "Commander"
    end

    -- 2. Try resolving Player Money / Credits
    pcall(function()
        if GetPlayerMoney then
            pCredits = tonumber(GetPlayerMoney()) or 0
        elseif C and C.GetPlayerMoney then
            pCredits = tonumber(C.GetPlayerMoney()) or 0
        end
    end)

    -- 3. Try resolving Player Sector via Component Hierarchy
    pcall(function()
        local function to64(val)
            if not val or val == 0 then return nil end
            if ConvertStringTo64Bit then
                local ok, res = pcall(ConvertStringTo64Bit, tostring(val))
                if ok and res and res ~= 0 then return res end
            end
            return val
        end

        local pid = nil
        pcall(function()
            if GetPlayerID then pid = GetPlayerID() end
            if not pid and C and pcall(function() return C.GetPlayerID end) then
                pid = C.GetPlayerID()
            end
        end)

        local shipId = nil
        pcall(function()
            if GetPlayerOccupiedShipID then shipId = GetPlayerOccupiedShipID() end
        end)

        local zoneId = nil
        pcall(function()
            if GetPlayerZone then zoneId = GetPlayerZone() end
        end)

        local candidates = {}
        if shipId and shipId ~= 0 then
            table.insert(candidates, shipId)
            local s64 = to64(shipId)
            if s64 and s64 ~= shipId then table.insert(candidates, s64) end
        end
        if pid and pid ~= 0 then
            table.insert(candidates, pid)
            local p64 = to64(pid)
            if p64 and p64 ~= pid then table.insert(candidates, p64) end
        end
        if zoneId and zoneId ~= 0 then
            table.insert(candidates, zoneId)
            local z64 = to64(zoneId)
            if z64 and z64 ~= zoneId then table.insert(candidates, z64) end
        end

        local secId = nil
        for _, cid in ipairs(candidates) do
            -- 1. Global GetContextByClass
            if not secId and GetContextByClass then
                local ok, res = pcall(GetContextByClass, cid, "sector", false)
                if ok and res and res ~= 0 then secId = res end
                if not secId then
                    local ok2, res2 = pcall(GetContextByClass, cid, "sector")
                    if ok2 and res2 and res2 ~= 0 then secId = res2 end
                end
            end
            -- 2. Cluster fallback
            if not secId and GetContextByClass then
                local ok, res = pcall(GetContextByClass, cid, "cluster", false)
                if ok and res and res ~= 0 then secId = res end
            end
            if secId then break end
        end

        if secId then
            local secName = nil
            if not secName and GetComponentName then
                local ok, res = pcall(GetComponentName, secId)
                if ok and res then secName = cdataOrStringToLua(res) end
            end
            if (not secName or secName == "" or secName:find("^cdata:")) and C and C.GetComponentName then
                local ok, res = pcall(C.GetComponentName, secId)
                if ok and res then secName = cdataOrStringToLua(res) end
            end
            if (not secName or secName == "" or secName:find("^cdata:")) and GetComponentData then
                local ok, res = pcall(GetComponentData, secId, "name")
                if ok and res then secName = cdataOrStringToLua(res) end
            end
            if (not secName or secName == "" or secName:find("^cdata:")) and GetComponentData then
                local ok, res = pcall(GetComponentData, secId, "knownname")
                if ok and res then secName = cdataOrStringToLua(res) end
            end
            if (not secName or secName == "" or secName:find("^cdata:")) and C and C.GetComponentData then
                local ok, res = pcall(C.GetComponentData, secId, "name")
                if ok and res then secName = cdataOrStringToLua(res) end
            end
            if (not secName or secName == "" or secName:find("^cdata:")) and C and C.GetComponentData then
                local ok, res = pcall(C.GetComponentData, secId, "knownname")
                if ok and res then secName = cdataOrStringToLua(res) end
            end

            if secName and secName:sub(1,1) == "{" then
                local p, id = secName:match("^{%s*(%d+)%s*,%s*(%d+)%s*}")
                if p and id and ReadText then
                    local ok, txt = pcall(ReadText, tonumber(p), tonumber(id))
                    if ok and txt and txt ~= "" then secName = txt end
                end
                if secName:sub(1,1) == "{" and GetText then
                    local ok, txt = pcall(GetText, secName)
                    if ok and txt and txt ~= "" then secName = txt end
                end
            end

            if secName and secName ~= "" and not secName:find("^cdata:") and secName ~= "Unknown" and secName ~= "Deep Space" then
                pSector = secName
                cachedPlayerSector = secName
                logBridge("Pilot Sector resolved: " .. tostring(secName) .. " (secId: " .. tostring(secId) .. ")")
            else
                logBridge("Pilot Sector name query returned empty/cdata for secId: " .. tostring(secId))
            end
        else
            logBridge("Pilot Sector resolution: no sector ID found for player/ship")
        end
    end)

    if (not pSector or pSector == "Deep Space" or pSector == "Unknown") and cachedPlayerSector then
        pSector = cachedPlayerSector
    end

    return pName, pCredits, pSector
end

-- =========================================================================
-- Command Processing & Polling
-- =========================================================================
local function ProcessCommand(cmd)
    if not cmd or type(cmd) ~= "table" then return end
    local targetTable = tostring(cmd.table or "blueprints")
    logBridge("Handling dashboard command for table: " .. targetTable)

    -- If player telemetry requested, export immediately via engine API
    if targetTable == "player" or targetTable == "all" then
        pcall(function()
            local pName, pCredits, pSector = resolvePlayerTelemetry()
            local req = getRequest()
            if req then
                local playerPayload = {
                    player = { name = pName, credits = pCredits, sector = pSector }
                }
                req.new('POST')
                    :setUrl("http://127.0.0.1:3000/api/update")
                    :setBody(JSON.encode(playerPayload))
                    :addHeader("Content-Type", "application/json")
                    :send(function(r, e) end)
            end
        end)
    end

    -- If blueprints / modules / ships / equipment requested, query live engine directly via C.GetBlueprints!
    if targetTable == "modules" or targetTable == "ships" or targetTable == "equipment" or targetTable == "blueprints" or targetTable == "all" then
        local ownedList = GetEnginePlayerBlueprints(targetTable)
        if not ownedList or #ownedList == 0 then
            ownedList = GetEnginePlayerBlueprints(nil)
        end
        if ownedList and #ownedList > 0 then
            logBridge("C.GetBlueprints retrieved " .. tostring(#ownedList) .. " blueprints for table: " .. targetTable)
            local req = getRequest()
            if req then
                local payload = {
                    dataType = "engine_blueprints",
                    table = targetTable,
                    ownedWares = ownedList
                }
                req.new('POST')
                    :setUrl("http://127.0.0.1:3000/api/encyclopedia")
                    :setBody(JSON.encode(payload))
                    :addHeader("Content-Type", "application/json")
                    :send(function(r, e)
                        if e then logBridge("Error sending live blueprints: " .. tostring(e)) end
                    end)
            end
        else
            logBridge("Direct C.GetBlueprints returned empty or not accessible, using UI trigger fallback")
        end
    end

    -- Trigger Mission Director harvesting cue via UI event
    local triggered = false
    pcall(function()
        if AddUITriggeredEvent then
            AddUITriggeredEvent("X4_Request_Update", targetTable, "")
            AddUITriggeredEvent("x4_companion_bridge", "X4_Request_Update", targetTable)
            triggered = true
        end
        if C and C.AddUITriggeredEvent then
            C.AddUITriggeredEvent("X4_Request_Update", targetTable, "")
            C.AddUITriggeredEvent("x4_companion_bridge", "X4_Request_Update", targetTable)
            triggered = true
        end
        if Helper and Helper.addUITriggeredEvent then
            Helper.addUITriggeredEvent("X4_Request_Update", targetTable, "")
            Helper.addUITriggeredEvent("x4_companion_bridge", "X4_Request_Update", targetTable)
            triggered = true
        end
    end)
    logBridge("Dispatched AddUITriggeredEvent for table: " .. targetTable .. " (success: " .. tostring(triggered) .. ")")
end

local lastPollTime = 0
local POLL_INTERVAL = 1.0

local lastPlayerTelemetryTime = 0
local PLAYER_TELEMETRY_INTERVAL = 5.0

local function PollBackendCommands()
    local now = (type(GetCurRealTime) == "function" and GetCurRealTime())
             or (type(getElapsedTime) == "function" and getElapsedTime())
             or os.clock()

    -- Flush any open HTTP requests in djfhe client stack
    pcall(function()
        local cl = require("djfhe.http.client")
        if cl and cl.update then cl.update() end
    end)

    local req = getRequest()
    if not req then return end

    -- Send live pilot profile telemetry to server every 5 seconds
    if (now - lastPlayerTelemetryTime) >= PLAYER_TELEMETRY_INTERVAL then
        lastPlayerTelemetryTime = now
        pcall(function()
            local pName, pCredits, pSector = resolvePlayerTelemetry()
            req.new('POST')
                :setUrl("http://127.0.0.1:3000/api/update")
                :setBody(JSON.encode({ player = { name = pName, credits = pCredits, sector = pSector } }))
                :addHeader("Content-Type", "application/json")
                :send(function() end)
        end)
    end

    -- Poll for pending commands dispatched from dashboard (every 2 seconds)
    if (now - lastPollTime) >= POLL_INTERVAL then
        lastPollTime = now
        pcall(function()
            req.new('GET')
                :setUrl("http://127.0.0.1:3000/api/commands")
                :send(function(response, err)
                    if err or not response or not response.body then return end
                    local ok, data = pcall(JSON.decode, response.body)
                    if ok and data and type(data.commands) == "table" then
                        for _, cmd in ipairs(data.commands) do
                            ProcessCommand(cmd)
                        end
                    end
                end)
        end)
    end

    -- Immediate flush to start connections
    pcall(function()
        local cl = require("djfhe.http.client")
        if cl and cl.update then cl.update() end
    end)
end

-- =========================================================================
-- Initializations & Event Subscriptions
-- =========================================================================
RegisterEncyclopediaListener()
RegisterPlayerListener()

-- 1. Mission Director Heartbeat (CommandPollTimer every 2s)
if RegisterEvent then
    RegisterEvent("X4_Check_Commands", function()
        PollBackendCommands()
    end)
    RegisterEvent("X4_MD_Log", function(eventName, text)
        logBridge("MD-SIGNAL: " .. tostring(text or eventName))
    end)
end

-- 2. Client update hook from djfhe_http (50ms loop) & UI frame hooks
if RegisterEvent then
    RegisterEvent("djfhe.http.client.update", function()
        pcall(function()
            local cl = require("djfhe.http.client")
            if cl and cl.update then cl.update() end
        end)
        PollBackendCommands()
    end)
    RegisterEvent("game_loop", function()
        PollBackendCommands()
    end)
    RegisterEvent("onUpdate", function()
        PollBackendCommands()
    end)
end

-- 3. Initial trigger upon script load
pcall(PollBackendCommands)

