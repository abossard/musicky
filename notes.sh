# Full Disk Access required for Terminal!
DB=$(lsof -p $(pgrep -n usernoted) | awk '/db2\/db$/ {print $NF; exit}')
sqlite3 "$DB" 'SELECT datetime(delivered_date+978307200,"unixepoch","localtime") AS ts,
                      json_extract(data,"$.req.title"), 
                      json_extract(data,"$.req.body") 
               FROM record 
               WHERE clear_date IS NOT NULL 
               ORDER BY delivered_date DESC LIMIT 10;'