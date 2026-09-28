local M = {}

local function escape_str(s)
    local matches = {
        ['\\'] = '\\\\', ['"'] = '\\"', ['\b'] = '\\b',
        ['\f'] = '\\f', ['\n'] = '\\n', ['\r'] = '\\r', ['\t'] = '\\t'
    }
    return string.gsub(s, '["\\\b\f\n\r\t]', matches)
end

local function is_array(t)
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

function M.array(t)
    t = t or {}
    return setmetatable(t, { __jsontype = "array" })
end

function M.encode(val)
    local t = type(val)
    if t == "table" then
        if is_array(val) or (getmetatable(val) and getmetatable(val).__jsontype == "array") then
            local res = {}
            for _, v in ipairs(val) do
                table.insert(res, M.encode(v))
            end
            return "[" .. table.concat(res, ",") .. "]"
        else
            local res = {}
            for k, v in pairs(val) do
                local keyStr = tostring(k)
                table.insert(res, '"' .. escape_str(keyStr) .. '":' .. M.encode(v))
            end
            return "{" .. table.concat(res, ",") .. "}"
        end
    elseif t == "string" then
        return '"' .. escape_str(val) .. '"'
    elseif t == "number" then
        if val ~= val or val == math.huge or val == -math.huge then
            return "null"
        end
        return tostring(val)
    elseif t == "boolean" then
        return tostring(val)
    else
        return "null" -- Fallback for nil, userdata, functions
    end
end

return M
