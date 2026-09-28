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

-- Simple recursive descent JSON decoder
function M.decode(str)
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

return M
