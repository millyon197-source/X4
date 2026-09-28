local M = {}

local function escape_str(s)
    local matches = {
        ['\\'] = '\\\\', ['"'] = '\\"', ['\b'] = '\\b',
        ['\f'] = '\\f', ['\n'] = '\\n', ['\r'] = '\\r', ['\t'] = '\\t'
    }
    return string.gsub(s, '["\\\b\f\n\r\t]', matches)
end

local function is_array(t)
    local i = 1
    for _ in pairs(t) do
        if t[i] == nil then return false end
        i = i + 1
    end
    return i > 1
end

function M.encode(val)
    local t = type(val)
    if t == "table" then
        if is_array(val) then
            local res = {}
            for _, v in ipairs(val) do
                table.insert(res, M.encode(v))
            end
            return "[" .. table.concat(res, ",") .. "]"
        else
            local res = {}
            for k, v in pairs(val) do
                if type(k) == "string" then
                    table.insert(res, '"' .. escape_str(k) .. '":' .. M.encode(v))
                end
            end
            return "{" .. table.concat(res, ",") .. "}"
        end
    elseif t == "string" then
        return '"' .. escape_str(val) .. '"'
    elseif t == "number" or t == "boolean" then
        return tostring(val)
    else
        return "null" -- Fallback for nil, userdata, functions
    end
end

return M
