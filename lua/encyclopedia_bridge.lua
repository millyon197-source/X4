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
end
-- =========================================================================
-- Direct C/FFI Engine Bindings & String Converters
-- =========================================================================
local ffi = nil
pcall(function() ffi = require("ffi") end)

local C = nil
if ffi then
    C = ffi.C
    pcall(function()
        ffi.cdef[[
            typedef struct {
                const char* ware;
                const char* productionmethodid;
            } UIBlueprint;
        ]]
    end)
    pcall(function()
        ffi.cdef[[
            uint32_t GetNumBlueprints(const char* set, const char* category, const char* macroname);
            uint32_t GetBlueprints(UIBlueprint* result, uint32_t resultlen, const char* set, const char* category, const char* macroname);
        ]]
    end)
    pcall(function()
        ffi.cdef[[
            bool HasExtension(const char* extensionid);
            bool IsExtensionEnabled(const char* extensionid);
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

        for idxOrId, metrics in pairs(itemsTable) do
            local wareId = metrics.id or metrics["$id"] or idxOrId
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

        if pSector and pSector ~= "Deep Space" and pSector ~= "Unknown" and not pSector:find("^cdata:") then
            if cachedPlayerSector ~= pSector then
                logBridge("Pilot Sector updated (MD): " .. tostring(cachedPlayerSector) .. " -> " .. tostring(pSector))
            end
            cachedPlayerSector = pSector
        elseif (not pSector or pSector == "Deep Space" or pSector == "Unknown") and cachedPlayerSector then
            pSector = cachedPlayerSector
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

local function RegisterGameLoadedListener()
    if not RegisterEvent then return end

    local function handleGameLoaded(eventName)
        logBridge("event_game_loaded caught from MD (" .. tostring(eventName) .. ")! Notifying companion server to reload app UI...")
        local req = getRequest()
        if not req then return end

        local payload = {
            event = "game_loaded",
            action = "reload_ui",
            timestamp = os.time(),
            message = "event_game_loaded triggered from Mission Director"
        }

        req.new('POST')
            :setUrl("http://127.0.0.1:3000/api/game-loaded")
            :setBody(JSON.encode(payload))
            :addHeader("Content-Type", "application/json")
            :send(function(response, err)
                if err and DebugError then
                    DebugError("[X4 Companion Bridge] Game loaded notify error: " .. tostring(err))
                else
                    logBridge("Successfully notified companion server of game_loaded.")
                end
            end)
    end

    RegisterEvent("X4_Game_Loaded", handleGameLoaded)
    RegisterEvent("X4_Reload_UI", handleGameLoaded)
end

local function GetEnginePlayerBlueprints(categoryFilter)
    local ffiObj = ffi
    local cObj = C or (ffiObj and ffiObj.C) or (_G and _G.C)
    if not ffiObj or not cObj then return nil end

    local ok, result = pcall(function()
        if not cObj.GetNumBlueprints or not cObj.GetBlueprints then return nil end

        local cat = categoryFilter
        if cat == "all" or cat == "blueprints" then
            cat = nil
        elseif cat == "modules" then
            cat = "module"
        elseif cat == "ships" then
            cat = "ship"
        end

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
    if ok and result then return result end
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
            if C and C.GetPlayerID then pid = C.GetPlayerID() end
            if not pid and GetPlayerID then pid = GetPlayerID() end
        end)

        local shipId = nil
        pcall(function()
            if C and C.GetPlayerOccupiedShipID then shipId = C.GetPlayerOccupiedShipID() end
            if not shipId and GetPlayerOccupiedShipID then shipId = GetPlayerOccupiedShipID() end
        end)

        local stationId = nil
        pcall(function()
            if C and C.GetPlayerOccupiedStationID then stationId = C.GetPlayerOccupiedStationID() end
            if not stationId and GetPlayerOccupiedStationID then stationId = GetPlayerOccupiedStationID() end
        end)

        local zoneId = nil
        pcall(function()
            if C and C.GetPlayerZone then zoneId = C.GetPlayerZone() end
            if not zoneId and GetPlayerZone then zoneId = GetPlayerZone() end
        end)

        local candidates = {}
        if shipId and shipId ~= 0 then
            table.insert(candidates, shipId)
            local s64 = to64(shipId)
            if s64 and s64 ~= shipId then table.insert(candidates, s64) end
        end
        if stationId and stationId ~= 0 then
            table.insert(candidates, stationId)
            local st64 = to64(stationId)
            if st64 and st64 ~= stationId then table.insert(candidates, st64) end
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
        local getCtx = (C and C.GetContextByClass) or GetContextByClass
        if getCtx then
            for _, cid in ipairs(candidates) do
                local ok, res = pcall(getCtx, cid, "sector", false)
                if ok and res and res ~= 0 then secId = res; break end
                local ok2, res2 = pcall(getCtx, cid, "sector")
                if ok2 and res2 and res2 ~= 0 then secId = res2; break end
                local ok3, res3 = pcall(getCtx, cid, "cluster", false)
                if ok3 and res3 and res3 ~= 0 then secId = res3; break end
            end
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
                if DebugError then DebugError("[X4 Companion Bridge] Pilot Sector resolved: " .. tostring(secName)) end
            else
                if DebugError then DebugError("[X4 Companion Bridge] Pilot Sector name query returned empty for secId: " .. tostring(secId)) end
            end
        else
            if DebugError then DebugError("[X4 Companion Bridge] Pilot Sector resolution: no sector ID found for player/ship") end
        end
    end)

    if (not pSector or pSector == "Deep Space" or pSector == "Unknown") and cachedPlayerSector then
        pSector = cachedPlayerSector
    end

    return pName, pCredits, pSector
end

-- =========================================================================
-- DLC / Extension Inclusion Resolver via GetExtensions()
-- =========================================================================
local function resolveInstalledDLCs(requestContext)
    local detected = {}
    local calledMethod = "none"

    local diag = "diag: getExtList=" .. tostring(type(GetExtensionList))
        .. ", _G.getExtList=" .. tostring(type(_G and _G.GetExtensionList))
        .. ", getExts=" .. tostring(type(GetExtensions))
        .. ", ffi=" .. tostring(ffi ~= nil)
        .. ", C=" .. tostring(C ~= nil)

    -- 1. Native X4 UI API: GetExtensionList()
    pcall(function()
        local getExtList = GetExtensionList or (_G and _G.GetExtensionList) or (Helper and Helper.getExtensionList)
        if getExtList then
            local exts = getExtList()
            if type(exts) == "table" then
                calledMethod = "GetExtensionList"
                for _, ext in ipairs(exts) do
                    if ext and ext.id then
                        local id = tostring(ext.id):lower()
                        local isEnabled = (ext.enabled == true) or (ext.enabled == 1)
                        detected[id] = { present = true, active = isEnabled }
                    end
                end
            end
        end
    end)

    -- 2. Fallback: GetExtensions()
    if calledMethod == "none" then
        pcall(function()
            local getExts = GetExtensions or (_G and _G.GetExtensions) or (Helper and Helper.getExtensions)
            if getExts then
                local exts = getExts()
                if type(exts) == "table" then
                    calledMethod = "GetExtensions"
                    for _, ext in ipairs(exts) do
                        if ext and ext.id then
                            local id = tostring(ext.id):lower()
                            local isEnabled = (ext.active == true or ext.active == 1 or ext.enabled == true or ext.enabled == 1)
                            detected[id] = { present = true, active = isEnabled }
                        end
                    end
                end
            end
        end)
    end

    -- 3. Direct C/FFI Engine Functions: C.HasExtension & C.IsExtensionEnabled
    if calledMethod == "none" then
        local okC, errC = pcall(function()
            local cObj = C or (ffi and ffi.C)
            if not cObj then
                diag = diag .. ", cObj=nil"
                return
            end
            local checkList = { "ego_dlc_split", "ego_dlc_cradle", "ego_dlc_terran", "ego_dlc_pirates", "ego_dlc_pirate", "ego_dlc_boron", "ego_dlc_timelines", "ego_dlc_par_update" }
            for _, dlcId in ipairs(checkList) do
                local hasExt = false
                local isEnabled = false
                local checkedAny = false
                if cObj.HasExtension then
                    local ok, val = pcall(cObj.HasExtension, dlcId)
                    if ok then
                        checkedAny = true
                        hasExt = (val == true or val == 1)
                    else
                        diag = diag .. ", errHasExt=" .. tostring(val)
                    end
                end
                if cObj.IsExtensionEnabled then
                    local ok, val = pcall(cObj.IsExtensionEnabled, dlcId)
                    if ok then
                        checkedAny = true
                        isEnabled = (val == true or val == 1)
                    else
                        diag = diag .. ", errIsEn=" .. tostring(val)
                    end
                end
                if checkedAny and (hasExt or isEnabled) then
                    detected[dlcId] = { present = hasExt or isEnabled, active = isEnabled }
                    calledMethod = "C.HasExtension"
                end
            end
        end)
        if not okC then diag = diag .. ", errPcallC=" .. tostring(errC) end
    end

    -- 3. C-API / Engine Fallback: C.GetNumExtensions & C.GetExtensionInfo
    pcall(function()
        local getNum = (C and C.GetNumExtensions) or GetNumExtensions or (_G and _G.GetNumExtensions)
        local getInfo = (C and C.GetExtensionInfo) or GetExtensionInfo or (_G and _G.GetExtensionInfo)
        if getNum and getInfo then
            local n = getNum()
            for i = 1, n do
                local info = getInfo(i)
                if info and info.id then
                    local id = tostring(info.id):lower()
                    if detected[id] == nil then
                        local isActive = false
                        if info.active ~= nil then
                            isActive = (info.active == true) or (info.active == 1)
                        else
                            local isActFn = IsExtensionActive or (C and C.IsExtensionActive)
                            if isActFn then
                                local ok, act = pcall(isActFn, info.id)
                                isActive = (ok and (act == true or act == 1))
                            else
                                isActive = (info.enabled == true) or (info.enabled == 1)
                            end
                        end
                        detected[id] = { present = true, active = isActive }
                        if calledMethod == "none" then calledMethod = "C.GetExtensionInfo" end
                    end
                end
            end
        end
    end)

    -- 4. Supplementary check: IsExtensionEnabled / IsExtensionActive
    pcall(function()
        local checkList = { "ego_dlc_split", "ego_dlc_cradle", "ego_dlc_terran", "ego_dlc_pirates", "ego_dlc_pirate", "ego_dlc_boron", "ego_dlc_timelines", "ego_dlc_par_update" }
        for _, dlcId in ipairs(checkList) do
            if detected[dlcId] == nil then
                local isEnFn = (C and C.IsExtensionEnabled) or IsExtensionEnabled
                local isActFn = (C and C.IsExtensionActive) or IsExtensionActive
                if isEnFn then
                    local okEn, en = pcall(isEnFn, dlcId)
                    if okEn and en then
                        local okAct, act = pcall(isActFn or function() return true end, dlcId)
                        detected[dlcId] = { present = true, active = (okAct and act) or false }
                        if calledMethod == "none" then calledMethod = "IsExtensionEnabled" end
                    end
                end
            end
        end
    end)

    local function extractDlc(aliases)
        local present = false
        local active = false
        for _, a in ipairs(aliases) do
            local d = detected[a]
            if d then
                if d.present then present = true end
                if d.active then active = true end
            end
        end
        return { active = active, present = present }
    end

    local activeDLCs = {
        ego_dlc_split = extractDlc({ "ego_dlc_split" }),
        ego_dlc_cradle = extractDlc({ "ego_dlc_cradle", "ego_dlc_terran" }),
        ego_dlc_pirates = extractDlc({ "ego_dlc_pirates", "ego_dlc_pirate" }),
        ego_dlc_boron = extractDlc({ "ego_dlc_boron" }),
        ego_dlc_timelines = extractDlc({ "ego_dlc_timelines" }),
        ego_dlc_par_update = extractDlc({ "ego_dlc_par_update" })
    }

    local isValid = (calledMethod ~= "none")

    if requestContext then
        logBridge("Active DLCs resolved via " .. calledMethod .. "() [valid=" .. tostring(isValid) .. "] for request [" .. tostring(requestContext) .. "]: "
            .. "Split(act=" .. tostring(activeDLCs.ego_dlc_split.active) .. ", pres=" .. tostring(activeDLCs.ego_dlc_split.present) .. "), "
            .. "Cradle(act=" .. tostring(activeDLCs.ego_dlc_cradle.active) .. ", pres=" .. tostring(activeDLCs.ego_dlc_cradle.present) .. "), "
            .. "Pirates(act=" .. tostring(activeDLCs.ego_dlc_pirates.active) .. ", pres=" .. tostring(activeDLCs.ego_dlc_pirates.present) .. "), "
            .. "Boron(act=" .. tostring(activeDLCs.ego_dlc_boron.active) .. ", pres=" .. tostring(activeDLCs.ego_dlc_boron.present) .. "), "
            .. "Timelines(act=" .. tostring(activeDLCs.ego_dlc_timelines.active) .. ", pres=" .. tostring(activeDLCs.ego_dlc_timelines.present) .. "), "
            .. "Par(act=" .. tostring(activeDLCs.ego_dlc_par_update.active) .. ", pres=" .. tostring(activeDLCs.ego_dlc_par_update.present) .. ") | " .. tostring(diag))
    end

    return activeDLCs, isValid, calledMethod
end

-- =========================================================================
-- Dedicated Isolated GetExtensions() API
-- =========================================================================
local function QueryExtensionsOnly(requestContext, commandId)
    logBridge("Calling GetExtensions() API (isolated from global table retrieval)...")
    local dlcs, isValid, calledMethod = resolveInstalledDLCs(requestContext or "isolated_dlcs_query")
    local req = getRequest()
    if req then
        local payload = {
            source = (isValid and "GetExtensions") or "unverified",
            action = "GET_EXTENSIONS",
            requestTable = "dlcs",
            commandId = tostring(commandId or ""),
            dlcs = dlcs,
            valid = isValid,
            method = calledMethod,
            timestamp = (type(GetCurRealTime) == "function" and GetCurRealTime()) or os.time()
        }
        req.new('POST')
            :setUrl("http://127.0.0.1:3000/api/dlcs")
            :setBody(JSON.encode(payload))
            :addHeader("Content-Type", "application/json")
            :addHeader("Connection", "close")
            :send(function(r, err)
                if err then
                    logBridge("Error sending isolated GetExtensions() payload: " .. tostring(err))
                else
                    logBridge("Successfully transmitted isolated GetExtensions() DLC status to Companion server (valid=" .. tostring(isValid) .. ", method=" .. tostring(calledMethod) .. ")")
                end
            end)
    end
    return dlcs
end

-- =========================================================================
-- Command Processing & Polling
-- =========================================================================
local function ProcessCommand(cmd)
    if not cmd or type(cmd) ~= "table" then return end
    local targetTable = tostring(cmd.table or "blueprints")
    local targetAction = tostring(cmd.action or "HARVEST_TABLE")
    logBridge("Handling dashboard command [" .. targetAction .. "] for table: " .. targetTable)

    -- Isolated GetExtensions() branch: fully separate from all global table retrieval
    if targetAction == "GET_EXTENSIONS" or targetTable == "dlcs" or targetTable == "extensions" then
        QueryExtensionsOnly("on_demand_dlcs_query", cmd.id)
        return
    end

    -- Call GetExtensions() specifically to determine active DLCs for the current request
    local currentDlcs = resolveInstalledDLCs(targetTable)

    -- Dispatch active DLCs to Companion Server to update Companion UI for this request
    pcall(function()
        local req = getRequest()
        if req then
            local dlcPayload = {
                dlcs = currentDlcs,
                requestTable = targetTable,
                commandId = tostring(cmd.id or ""),
                timestamp = (type(GetCurRealTime) == "function" and GetCurRealTime()) or os.time()
            }
            req.new('POST')
                :setUrl("http://127.0.0.1:3000/api/dlcs")
                :setBody(JSON.encode(dlcPayload))
                :addHeader("Content-Type", "application/json")
                :send(function(r, err)
                    if err then
                        logBridge("Error sending request DLCs to /api/dlcs: " .. tostring(err))
                    end
                end)
        end
    end)

    -- If player telemetry requested, export immediately via engine API
    if targetTable == "player" or targetTable == "all" then
        pcall(function()
            local pName, pCredits, pSector = resolvePlayerTelemetry()
            local req = getRequest()
            if req then
                local playerPayload = {
                    player = { name = pName, credits = pCredits, sector = pSector },
                    dlcs = currentDlcs
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
        if type(ownedList) == "table" then
            logBridge("C.GetBlueprints retrieved " .. tostring(#ownedList) .. " blueprints for table: " .. targetTable)
            local req = getRequest()
            if req then
                local payload = {
                    dataType = "engine_blueprints",
                    table = targetTable,
                    ownedWares = ownedList,
                    dlcs = currentDlcs
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
            logBridge("Direct C.GetBlueprints returned nil or not accessible, using UI trigger fallback")
        end
    end

    if not cmd or cmd.source ~= "md_post_load" then
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
end

local pollInFlightUntil = 0
local telemetryInFlightUntil = 0
local dlcUpdateInFlightUntil = 0

local lastPollTime = 0
local POLL_INTERVAL = 0.5

local lastPlayerTelemetryTime = 0
local PLAYER_TELEMETRY_INTERVAL = 3.0

local lastDlcUpdateTime = 0
local DLC_UPDATE_INTERVAL = 10.0

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

    -- Send live pilot profile telemetry to server every 3 seconds (self-healing 4s timeout)
    if (now - lastPlayerTelemetryTime) >= PLAYER_TELEMETRY_INTERVAL and now >= telemetryInFlightUntil then
        lastPlayerTelemetryTime = now
        telemetryInFlightUntil = now + 4.0
        pcall(function()
            local pName, pCredits, pSector = resolvePlayerTelemetry()
            local payload = {
                player = {
                    name = pName,
                    credits = pCredits,
                    sector = pSector
                }
            }
            req.new('POST')
                :setUrl("http://127.0.0.1:3000/api/update")
                :setBody(JSON.encode(payload))
                :addHeader("Content-Type", "application/json")
                :addHeader("Connection", "close")
                :send(function()
                    telemetryInFlightUntil = 0
                end)
        end)
    end

    -- Query & broadcast DLC content using GetExtensions() every 10 seconds (self-healing 8s timeout)
    if (now - lastDlcUpdateTime) >= DLC_UPDATE_INTERVAL and now >= dlcUpdateInFlightUntil then
        lastDlcUpdateTime = now
        dlcUpdateInFlightUntil = now + 8.0
        pcall(function()
            QueryExtensionsOnly("periodic_10s_dlc_update")
            dlcUpdateInFlightUntil = 0
        end)
    end

    -- Poll for pending commands dispatched from dashboard (self-healing 2s timeout)
    if (now - lastPollTime) >= POLL_INTERVAL and now >= pollInFlightUntil then
        lastPollTime = now
        pollInFlightUntil = now + 2.0
        pcall(function()
            req.new('GET')
                :setUrl("http://127.0.0.1:3000/api/commands")
                :addHeader("Connection", "close")
                :send(function(response, err)
                    pollInFlightUntil = 0
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
RegisterGameLoadedListener()

-- 1. Mission Director Heartbeat (CommandPollTimer every 2s)
if RegisterEvent then
    RegisterEvent("X4_Check_Commands", function()
        PollBackendCommands()
    end)
    RegisterEvent("X4_MD_Log", function(eventName, text)
        logBridge("MD-SIGNAL: " .. tostring(text or eventName))
    end)
    RegisterEvent("X4_Request_All_Tables", function(eventName, text)
        logBridge("MD-SIGNAL: [Companion Bridge] X4_Request_All_Tables event received: requesting All Tables global refresh...")
        ProcessCommand({ action = "HARVEST_TABLE", table = "all", source = "md_post_load" })
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
pcall(function()
    local req = getRequest()
    if req then
        req.new('POST')
            :setUrl("http://127.0.0.1:3000/api/debug-log")
            :setBody(JSON.encode({ message = "X4 Companion Bridge Lua script loaded successfully!" }))
            :addHeader("Content-Type", "application/json")
            :send(function() end)
    end
end)
pcall(PollBackendCommands)

