# MongoDB Connection Troubleshooting

## ⚠️ Current Error
```
❌ Database connection failed: querySrv ECONNREFUSED _mongodb._tcp.cluster0.tfe9svb.mongodb.net
```

This error means **DNS SRV record lookup is failing**. Your machine cannot resolve MongoDB Atlas DNS records.

---

## 🔧 Solutions (Try in Order)

### **Solution 1: Whitelist Your IP in MongoDB Atlas** ✅ MOST COMMON FIX
MongoDB Atlas blocks connections from IPs that aren't whitelisted.

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Select your cluster → **Network Access**
3. Click **Add IP Address**
4. Choose one of:
   - **Add Current IP Address** (if you know your current IP)
   - **Allow Access from Anywhere** (0.0.0.0/0) - ⚠️ Less secure but useful for testing
5. Click **Confirm**
6. **Restart the app** (`npm run dev`)

**Your Current IP:** Check https://whatismyipaddress.com/ or run:
```powershell
curl https://api.ipify.org
```

---

### **Solution 2: Use Standard Connection String (Non-SRV)**
If DNS SRV queries are blocked in your network, use the standard format:

In `.env`, replace:
```
DB_URI=mongodb+srv://prit9265:pritesh69@cluster0.tfe9svb.mongodb.net/attendance-app
```

With (get from MongoDB Atlas):
```
DB_URI=mongodb://prit9265:pritesh69@cluster0-shard-00-00.tfe9svb.mongodb.net:27017,cluster0-shard-00-01.tfe9svb.mongodb.net:27017,cluster0-shard-00-02.tfe9svb.mongodb.net:27017/?ssl=true&replicaSet=atlas-xxx&authSource=admin&retryWrites=true&w=majority
```

Get this from MongoDB Atlas: **Cluster** → **Connect** → **Drivers** → Copy connection string

---

### **Solution 3: Use Local MongoDB (For Development)**
Install and run MongoDB locally for development:

1. **Download MongoDB Community**: https://www.mongodb.com/try/download/community
2. **Install it**
3. **Update .env**:
   ```
   DB_URI=mongodb://localhost:27017/attendance-app
   FORCE_GOOGLE_DNS=false
   ```
4. **Start MongoDB Server**:
   ```powershell
   # Windows - MongoDB runs as service by default
   # Or manually run: mongod
   ```
5. **Run the app**:
   ```powershell
   npm run dev
   ```

---

### **Solution 4: Disable DNS SRV and Use Specific Hosts**
If your network blocks DNS SRV queries, ask MongoDB Atlas support to provide direct host addresses.

---

## 🔍 Diagnostic Steps

### Check if you can reach MongoDB Atlas:
```powershell
# Test DNS resolution
nslookup cluster0.tfe9svb.mongodb.net

# Test connection to a specific host
Test-NetConnection cluster0-shard-00-00.tfe9svb.mongodb.net -Port 27017
```

### Check network connectivity:
```powershell
# Test internet connectivity
ping 8.8.8.8

# Test if firewall blocks MongoDB port
Test-NetConnection -ComputerName cluster0.tfe9svb.mongodb.net -Port 27017
```

---

## ✅ Quick Fixes Checklist

- [ ] Whitelisted my IP in MongoDB Atlas Network Access
- [ ] Verified .env has the correct DB_URI with database name at the end
- [ ] `FORCE_GOOGLE_DNS=true` is enabled in .env
- [ ] Network firewall allows outbound connection to port 27017
- [ ] Not behind a corporate proxy/VPN blocking connections

---

## 📝 Recommended Next Steps

1. **First**: Go to MongoDB Atlas and add your IP to Network Access
2. **Verify**: Run `npm run dev` and check for success message
3. **If still failing**: Try Solution 2 or 3 above

**Questions?** Check MongoDB Atlas docs: https://docs.atlas.mongodb.com/
