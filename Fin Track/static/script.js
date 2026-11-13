// ---------- Elements ----------
var loginPage = document.getElementById("loginPage");
var app = document.getElementById("app");
 
var loginForm = document.getElementById("loginForm");
var usernameInput = document.getElementById("username");
var passwordInput = document.getElementById("password");
var loginError = document.getElementById("loginError");
var loginTitle = document.getElementById("loginTitle");
var loginBtn = document.getElementById("loginBtn");
var switchText = document.getElementById("switchText");
var switchLink = document.getElementById("switchLink");
 
var form = document.getElementById("transactionForm");
var descriptionInput = document.getElementById("description");
var amountInput = document.getElementById("amount");
var typeInput = document.getElementById("type");
var categoryInput = document.getElementById("category");
var dateInput = document.getElementById("date");
var transactionList = document.getElementById("transactionList");
var searchInput = document.getElementById("search");
 
var udhaarForm = document.getElementById("udhaarForm");
var uType = document.getElementById("uType");
var uName = document.getElementById("uName");
var uAmount = document.getElementById("uAmount");
var uDate = document.getElementById("uDate");
var uDue = document.getElementById("uDue");
var uRemind = document.getElementById("uRemind");
var uNote = document.getElementById("uNote");
var uRate = document.getElementById("uRate");
var uRateUnit = document.getElementById("uRateUnit");
var uInterestType = document.getElementById("uInterestType");
 
// ---------- Variables ----------
var currentUser = null;
var transactions = [];
var editingId = null;
var isRegisterMode = false;
 
var udhaarItems = [];
var editingUdhaarId = null;
var udhaarFilter = "pending";
 
var profile = { photo: "", theme: "mint" };
var themeNames = ["mint", "sunset", "ocean", "aurora", "night", "photo"];
var currentCurrency = localStorage.getItem("fintrackCurrency") || "INR";
 
var currentView = "main";
var toastTimer = null;
 
// ---------- Server (Flask API) ----------
// Login ke baad server ek token deta hai. Wo token har request ke saath bhejte hain.
var authToken = localStorage.getItem("fintrackToken") || "";
 
function api(method, url, body) {
    var options = {
        method: method,
        headers: { "Content-Type": "application/json" }
    };
    if (authToken) {
        options.headers["Authorization"] = "Bearer " + authToken;
    }
    if (body !== undefined) {
        options.body = JSON.stringify(body);
    }
 
    return fetch(url, options).then(function (res) {
        return res.json().catch(function () {
            return {};
        }).then(function (data) {
            if (!res.ok) {
                var err = new Error(data.error || "Server error");
                err.status = res.status;
                throw err;
            }
            return data;
        });
    });
}
 
function pushToServer(payload) {
    api("PUT", "/api/data", payload).catch(function (err) {
        if (err.status === 401) {
            logout();
            alert("Session expired. Please login again.");
        } else {
            showToast("Could not save to server!");
        }
    });
}
 
function saveData() {
    pushToServer({ transactions: transactions });
}
 
function saveUdhaar() {
    pushToServer({ udhaar: udhaarItems });
}
 
function saveProfile() {
    pushToServer({ profile: profile });
}
 
// ---------- Small helpers ----------
function makeEl(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
        node.className = className;
    }
    if (text !== undefined) {
        node.textContent = text;
    }
    return node;
}
 
function round2(number) {
    return Math.round(number * 100) / 100;
}
 
function todayString() {
    var d = new Date();
    var month = d.getMonth() + 1;
    var day = d.getDate();
    if (month < 10) {
        month = "0" + month;
    }
    if (day < 10) {
        day = "0" + day;
    }
    return d.getFullYear() + "-" + month + "-" + day;
}
 
function parseDay(text) {
    return new Date(text + "T00:00:00");
}
 
function daysBetween(fromText, toText) {
    return Math.round((parseDay(toText) - parseDay(fromText)) / 86400000);
}
 
function shortDate(text) {
    return parseDay(text).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}
 
// ---------- Interest ----------
function interestEndDate(item) {
    if (item.settled && item.settledOn) {
        return item.settledOn;
    }
    return todayString();
}
 
// Interest "date given" se aaj tak (ya settle hone tak) ginta hai
function calcInterest(item) {
    var rate = Number(item.rate) || 0;
    if (rate <= 0) return 0;
 
    var days = daysBetween(item.date, interestEndDate(item));
    if (days <= 0) return 0;
 
    var periods = item.rateUnit === "year" ? days / 365 : days / 30;
    var r = rate / 100;
 
    var interest;
    if (item.interestType === "compound") {
        interest = item.amount * (Math.pow(1 + r, periods) - 1);
    } else {
        interest = item.amount * r * periods;
    }
    return round2(interest);
}
 
function totalDue(item) {
    return round2(item.amount + calcInterest(item));
}
 
function rateLabel(item) {
    var unit = item.rateUnit === "year" ? "year" : "month";
    var kind = item.interestType === "compound" ? "compound" : "simple";
    return "Interest: " + item.rate + "% per " + unit + " (" + kind + ")";
}
 
// ---------- Profile (photo + background theme) ----------
function applyProfile() {
    var letter = currentUser ? currentUser.charAt(0).toUpperCase() : "?";
    var avatars = document.querySelectorAll(".avatar");
 
    avatars.forEach(function (avatar) {
        if (profile.photo) {
            avatar.style.backgroundImage = 'url("' + profile.photo + '")';
            avatar.textContent = "";
        } else {
            avatar.style.backgroundImage = "";
            avatar.textContent = letter;
        }
    });
 
    var theme = profile.theme;
    if (theme === "photo" && !profile.photo) {
        theme = "mint";
    }
 
    document.body.setAttribute("data-theme", theme);
    document.getElementById("bgLayer").style.backgroundImage =
        theme === "photo" ? 'url("' + profile.photo + '")' : "";
 
    var photoSwatch = document.getElementById("photoSwatch");
    if (profile.photo) {
        photoSwatch.style.backgroundImage = 'url("' + profile.photo + '")';
        photoSwatch.textContent = "";
    } else {
        photoSwatch.style.backgroundImage = "";
        photoSwatch.textContent = "📷";
    }
 
    document.querySelectorAll(".theme-swatch").forEach(function (swatch) {
        swatch.classList.toggle("active", swatch.getAttribute("data-theme") === theme);
    });
}
 
function openProfile() {
    document.getElementById("profileName").textContent = currentUser;
    document.getElementById("profileModal").classList.remove("hidden");
}
 
function closeProfile() {
    document.getElementById("profileModal").classList.add("hidden");
}
 
document.querySelectorAll(".avatar-open").forEach(function (avatar) {
    avatar.addEventListener("click", openProfile);
    avatar.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openProfile();
        }
    });
});
 
document.getElementById("profileClose").addEventListener("click", closeProfile);
document.getElementById("profileDone").addEventListener("click", closeProfile);
document.getElementById("profileModal").addEventListener("click", function (event) {
    if (event.target === this) {
        closeProfile();
    }
});
 
document.getElementById("photoUpload").addEventListener("click", function () {
    document.getElementById("photoInput").click();
});
document.getElementById("bigAvatar").addEventListener("click", function () {
    document.getElementById("photoInput").click();
});
 
document.getElementById("photoInput").addEventListener("change", function () {
    var input = this;
    var file = input.files[0];
    if (!file) return;
 
    if (file.type.indexOf("image/") !== 0) {
        alert("Please choose an image file.");
        input.value = "";
        return;
    }
 
    var reader = new FileReader();
    reader.onload = function () {
        var img = new Image();
        img.onload = function () {
            var size = 320;
            var canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
 
            var side = Math.min(img.width, img.height);
            var sx = (img.width - side) / 2;
            var sy = (img.height - side) / 2;
            canvas.getContext("2d").drawImage(img, sx, sy, side, side, 0, 0, size, size);
 
            profile.photo = canvas.toDataURL("image/jpeg", 0.85);
            saveProfile();
            applyProfile();
        };
        img.onerror = function () {
            alert("Could not read this image. Try a JPG or PNG photo.");
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
    input.value = "";
});
 
document.getElementById("photoRemove").addEventListener("click", function () {
    profile.photo = "";
    if (profile.theme === "photo") {
        profile.theme = "mint";
    }
    saveProfile();
    applyProfile();
});
 
document.getElementById("themeRow").addEventListener("click", function (event) {
    var swatch = event.target.closest(".theme-swatch");
    if (!swatch) return;
 
    var theme = swatch.getAttribute("data-theme");
    if (theme === "photo" && !profile.photo) {
        alert("Upload a profile photo first, then you can use it as the background.");
        return;
    }
 
    profile.theme = theme;
    saveProfile();
    applyProfile();
});
 
// ---------- Views (Dashboard / Udhaar / Calculator / Settings) ----------
var views = { main: "viewMain", udhaar: "viewUdhaar", calc: "viewCalc", settings: "viewSettings" };
 
function showView(name) {
    Object.keys(views).forEach(function (key) {
        document.getElementById(views[key]).classList.toggle("hidden", key !== name);
    });
 
    if (name !== currentView) {
        window.scrollTo(0, 0);
    }
    currentView = name;
 
    var titles = {
        main: "Dashboard",
        udhaar: "Udhaar",
        calc: "Calculator",
        settings: "Settings"
    };
    var texts = {
        main: "Welcome " + currentUser + "! Here's your financial overview.",
        udhaar: "Keep track of money you gave and money you took.",
        calc: "Quick calculations, right here.",
        settings: "Manage your account, currency, and app data."
    };
    document.getElementById("pageTitle").textContent = titles[name];
    document.getElementById("welcome").textContent = texts[name];
 
    document.querySelectorAll(".nav").forEach(function (link) {
        var isThis = link.getAttribute("data-view") === name && !link.getAttribute("data-target");
        link.classList.toggle("active", isThis);
    });
}
 
document.querySelectorAll(".nav").forEach(function (link) {
    link.addEventListener("click", function (event) {
        event.preventDefault();
        showView(link.getAttribute("data-view"));
 
        document.querySelectorAll(".nav").forEach(function (other) {
            other.classList.remove("active");
        });
        link.classList.add("active");
 
        var targetId = link.getAttribute("data-target");
        if (targetId) {
            document.getElementById(targetId).scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    });
});
 
// ---------- Toast ----------
function showToast(message, onClick) {
    var toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
 
    toast.onclick = function () {
        toast.classList.add("hidden");
        if (onClick) onClick();
    };
 
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
        toast.classList.add("hidden");
    }, 7000);
}
 
// ---------- Login / Register ----------
function showLoginPage() {
    loginPage.classList.remove("hidden");
    app.classList.add("hidden");
}
 
function showApp() {
    // Pehle server se is user ka saara data laao, phir screen dikhao
    api("GET", "/api/data").then(function (data) {
        transactions = data.transactions || [];
        udhaarItems = data.udhaar || [];
 
        profile = { photo: "", theme: "mint" };
        if (data.profile) {
            profile.photo = data.profile.photo || "";
            if (themeNames.indexOf(data.profile.theme) !== -1) {
                profile.theme = data.profile.theme;
            }
        }
 
        loginPage.classList.add("hidden");
        app.classList.remove("hidden");
 
        document.getElementById("userName").textContent = currentUser;
 
        applyProfile();
 
        resetForm();
        resetUdhaarForm();
        searchInput.value = "";
        renderTransactions();
        updateDashboard();
 
        var reminders = renderUdhaar();
        showView("main");
        checkReminders();
 
        if (reminders > 0) {
            var word = reminders === 1 ? "udhaar reminder" : "udhaar reminders";
            showToast("⏰ " + reminders + " " + word + " - tap to view", function () {
                showView("udhaar");
            });
        }
    }).catch(function (err) {
        logout();
        if (err.status === 401) {
            loginError.textContent = "Session expired. Please login again.";
        } else {
            loginError.textContent = "Cannot connect to server. Is app.py running?";
        }
    });
}
 
switchLink.addEventListener("click", function (event) {
    event.preventDefault();
    isRegisterMode = !isRegisterMode;
    loginError.textContent = "";
 
    if (isRegisterMode) {
        loginTitle.textContent = "Create a new account";
        loginBtn.textContent = "Register";
        switchText.textContent = "Already have an account?";
        switchLink.textContent = "Login";
    } else {
        loginTitle.textContent = "Login to your account";
        loginBtn.textContent = "Login";
        switchText.textContent = "New here?";
        switchLink.textContent = "Create an account";
    }
});
 
loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
 
    var username = usernameInput.value.trim().toLowerCase();
    var password = passwordInput.value;
 
    if (username === "" || password === "") {
        loginError.textContent = "Please fill both fields.";
        return;
    }
 
    if (isRegisterMode && password.length < 4) {
        loginError.textContent = "Password must be at least 4 characters.";
        return;
    }
 
    var url = isRegisterMode ? "/api/register" : "/api/login";
 
    api("POST", url, { username: username, password: password }).then(function (data) {
        authToken = data.token;
        currentUser = data.username;
        localStorage.setItem("fintrackToken", authToken);
        localStorage.setItem("fintrackCurrentUser", currentUser);
 
        loginForm.reset();
        loginError.textContent = "";
        showApp();
    }).catch(function (err) {
        if (err.message === "Failed to fetch") {
            loginError.textContent = "Cannot connect to server. Is app.py running?";
        } else {
            loginError.textContent = err.message;
        }
    });
});
 
function logout() {
    localStorage.removeItem("fintrackCurrentUser");
    localStorage.removeItem("fintrackToken");
    authToken = "";
    currentUser = null;
    transactions = [];
    udhaarItems = [];
    profile = { photo: "", theme: "mint" };
 
    applyProfile();
    closeProfile();
    document.getElementById("toast").classList.add("hidden");
    showLoginPage();
}
 
document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("logoutBtn2").addEventListener("click", logout);
document.getElementById("logoutBtn3").addEventListener("click", logout);
 
// ---------- Today's date ----------
var today = new Date();
var localToday = todayString();
dateInput.value = localToday;
 
document.getElementById("today").textContent =
    today.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });
 
// ---------- Money format ----------
function formatMoney(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currentCurrency
    }).format(amount);
}
 
// ---------- Transactions Add / Edit / Delete ----------
function resetForm() {
    editingId = null;
    form.reset();
    dateInput.value = todayString();
    document.getElementById("formHeading").textContent = "Add Transaction";
    document.getElementById("submitBtn").textContent = "+ Add Transaction";
    document.getElementById("cancelEdit").classList.add("hidden");
}
 
document.getElementById("cancelEdit").addEventListener("click", resetForm);
 
form.addEventListener("submit", function (event) {
    event.preventDefault();
 
    var desc = descriptionInput.value.trim();
    var amt = parseFloat(amountInput.value);
    var type = typeInput.value;
    var cat = categoryInput.value;
    var date = dateInput.value;
 
    if (!desc || isNaN(amt) || amt <= 0 || !date) return;
 
    if (editingId !== null) {
        for (var i = 0; i < transactions.length; i++) {
            if (transactions[i].id === editingId) {
                transactions[i].description = desc;
                transactions[i].amount = round2(amt);
                transactions[i].type = type;
                transactions[i].category = cat;
                transactions[i].date = date;
                break;
            }
        }
        showToast("Transaction updated!");
    } else {
        transactions.unshift({
            id: Date.now(),
            description: desc,
            amount: round2(amt),
            type: type,
            category: cat,
            date: date
        });
        showToast("Transaction added!");
    }
 
    saveData();
    resetForm();
    renderTransactions();
    updateDashboard();
});
 
function renderTransactions() {
    var query = searchInput.value.trim().toLowerCase();
    transactionList.innerHTML = "";
 
    var filtered = transactions.filter(function (item) {
        return (
            item.description.toLowerCase().indexOf(query) !== -1 ||
            item.category.toLowerCase().indexOf(query) !== -1 ||
            item.date.indexOf(query) !== -1
        );
    });
 
    document.getElementById("emptyMessage").classList.toggle("hidden", filtered.length > 0);
 
    filtered.forEach(function (item) {
        var tr = document.createElement("tr");
 
        var tdDesc = makeEl("td", "", item.description);
        var tdCat = makeEl("td", "", item.category);
        var tdDate = makeEl("td", "", shortDate(item.date));
 
        var sign = item.type === "income" ? "+ " : "- ";
        var amtClass = item.type === "income" ? "positive" : "negative";
        var tdAmt = makeEl("td", amtClass, sign + formatMoney(item.amount));
 
        var tdAct = document.createElement("td");
 
        var editBtn = makeEl("button", "action-btn", "Edit");
        editBtn.type = "button";
        editBtn.onclick = function () {
            editingId = item.id;
            typeInput.value = item.type;
            descriptionInput.value = item.description;
            amountInput.value = item.amount;
            categoryInput.value = item.category;
            dateInput.value = item.date;
            document.getElementById("formHeading").textContent = "Edit Transaction";
            document.getElementById("submitBtn").textContent = "Save Changes";
            document.getElementById("cancelEdit").classList.remove("hidden");
            form.scrollIntoView({ behavior: "smooth" });
        };
 
        var delBtn = makeEl("button", "action-btn delete-btn", "Delete");
        delBtn.type = "button";
        delBtn.onclick = function () {
            transactions = transactions.filter(function (t) {
                return t.id !== item.id;
            });
            saveData();
            if (editingId === item.id) resetForm();
            renderTransactions();
            updateDashboard();
            showToast("Transaction deleted.");
        };
 
        tdAct.appendChild(editBtn);
        tdAct.appendChild(delBtn);
 
        tr.appendChild(tdDesc);
        tr.appendChild(tdCat);
        tr.appendChild(tdDate);
        tr.appendChild(tdAmt);
        tr.appendChild(tdAct);
        transactionList.appendChild(tr);
    });
}
 
searchInput.addEventListener("input", renderTransactions);
 
// ---------- Dashboard ----------
function updateDashboard() {
    var totalIncome = 0;
    var totalExpense = 0;
 
    for (var i = 0; i < transactions.length; i++) {
        if (transactions[i].type === "income") {
            totalIncome += transactions[i].amount;
        } else {
            totalExpense += transactions[i].amount;
        }
    }
 
    var balance = totalIncome - totalExpense;
 
    document.getElementById("income").textContent = formatMoney(totalIncome);
    document.getElementById("expense").textContent = formatMoney(totalExpense);
    document.getElementById("balance").textContent = formatMoney(balance);
 
    var maxValue = Math.max(totalIncome, totalExpense, 1);
 
    document.getElementById("incomeBar").style.height = (totalIncome / maxValue * 140) + "px";
    document.getElementById("expenseBar").style.height = (totalExpense / maxValue * 140) + "px";
 
    updateComparison();
    updateCircle(totalIncome, totalExpense);
    updateCategoryChart();
}
 
// ---------- Expenses by category (circle chart) ----------
var categoryColors = {
    Food: "#f2a93b",
    Travel: "#287cc4",
    Shopping: "#e76b72",
    Fashion: "#2ec4d6",
    Education: "#8a6fd1",
    Entertainment: "#e07bb5",
    Salary: "#20b486",
    Other: "#7f8da3"
};
 
function updateCategoryChart() {
    var circle = document.getElementById("categoryCircle");
    var legend = document.getElementById("categoryLegend");
    legend.innerHTML = "";
 
    var totals = {};
    var totalExpense = 0;
 
    for (var i = 0; i < transactions.length; i++) {
        if (transactions[i].type === "expense") {
            var name = transactions[i].category;
            totals[name] = (totals[name] || 0) + transactions[i].amount;
            totalExpense += transactions[i].amount;
        }
    }
 
    document.getElementById("categoryTotal").textContent = formatMoney(totalExpense);
 
    var names = Object.keys(totals);
    if (names.length === 0) {
        circle.style.background = "#e9edf3";
        legend.appendChild(makeEl("p", "empty", "No expenses yet."));
        return;
    }
 
    names.sort(function (a, b) {
        return totals[b] - totals[a];
    });
 
    var parts = [];
    var start = 0;
 
    names.forEach(function (name, index) {
        var percent = totals[name] / totalExpense * 100;
        var end = index === names.length - 1 ? 100 : start + percent;
 
        var color = categoryColors[name] || "#7f8da3";
        parts.push(color + " " + start + "% " + end + "%");
        start = end;
 
        var row = document.createElement("p");
        var dot = makeEl("span", "dot");
        dot.style.background = color;
        var label = makeEl("span", "", name);
        var value = makeEl("strong", "", formatMoney(totals[name]) + " (" + Math.round(percent) + "%)");
 
        row.appendChild(dot);
        row.appendChild(label);
        row.appendChild(value);
        legend.appendChild(row);
    });
 
    circle.style.background = "conic-gradient(" + parts.join(", ") + ")";
}
 
// ---------- Circle / Bar Chart Toggle ----------
function updateCircle(totalIncome, totalExpense) {
    var circle = document.getElementById("circle");
    var total = totalIncome + totalExpense;
 
    if (total === 0) {
        circle.style.background = "#e9edf3";
        document.getElementById("circleBig").textContent = "0%";
        document.getElementById("legendIncome").textContent = formatMoney(0) + " (0%)";
        document.getElementById("legendExpense").textContent = formatMoney(0) + " (0%)";
        return;
    }
 
    var incomePercent = Math.round(totalIncome / total * 100);
    var expensePercent = 100 - incomePercent;
 
    circle.style.background =
        "conic-gradient(#20b486 0% " + incomePercent + "%, #e76b72 " + incomePercent + "% 100%)";
 
    document.getElementById("circleBig").textContent = expensePercent + "%";
    document.getElementById("legendIncome").textContent = formatMoney(totalIncome) + " (" + incomePercent + "%)";
    document.getElementById("legendExpense").textContent = formatMoney(totalExpense) + " (" + expensePercent + "%)";
}
 
document.getElementById("barBtn").addEventListener("click", function () {
    this.classList.add("active");
    document.getElementById("circleBtn").classList.remove("active");
    document.getElementById("barChart").classList.remove("hidden");
    document.getElementById("circleChart").classList.add("hidden");
});
 
document.getElementById("circleBtn").addEventListener("click", function () {
    this.classList.add("active");
    document.getElementById("barBtn").classList.remove("active");
    document.getElementById("circleChart").classList.remove("hidden");
    document.getElementById("barChart").classList.add("hidden");
});
 
// ---------- Monthly comparison ----------
function getMonthKey(date) {
    var month = date.getMonth() + 1;
    if (month < 10) month = "0" + month;
    return date.getFullYear() + "-" + month;
}
 
function getMonthTotals(monthKey) {
    var income = 0;
    var expense = 0;
    for (var i = 0; i < transactions.length; i++) {
        if (transactions[i].date.substring(0, 7) === monthKey) {
            if (transactions[i].type === "income") {
                income += transactions[i].amount;
            } else {
                expense += transactions[i].amount;
            }
        }
    }
    return { income: income, expense: expense, balance: income - expense };
}
 
function formatDiff(diff) {
    if (diff === 0) return "—";
    var sign = diff > 0 ? "+" : "-";
    return sign + formatMoney(Math.abs(diff));
}
 
function updateComparison() {
    var now = new Date();
    var prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
 
    var thisKey = getMonthKey(now);
    var lastKey = getMonthKey(prev);
 
    var thisName = now.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    var lastName = prev.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
 
    document.getElementById("thisMonthName").textContent = thisName;
    document.getElementById("lastMonthName").textContent = lastName;
    document.getElementById("compareNote").textContent = "Comparing " + lastName + " vs " + thisName;
 
    var cur = getMonthTotals(thisKey);
    var old = getMonthTotals(lastKey);
 
    document.getElementById("lastIncome").textContent = formatMoney(old.income);
    document.getElementById("thisIncome").textContent = formatMoney(cur.income);
    var incDiff = cur.income - old.income;
    var incEl = document.getElementById("changeIncome");
    incEl.textContent = formatDiff(incDiff);
    incEl.className = incDiff > 0 ? "positive" : incDiff < 0 ? "negative" : "";
 
    document.getElementById("lastExpense").textContent = formatMoney(old.expense);
    document.getElementById("thisExpense").textContent = formatMoney(cur.expense);
    var expDiff = cur.expense - old.expense;
    var expEl = document.getElementById("changeExpense");
    expEl.textContent = formatDiff(expDiff);
    expEl.className = expDiff < 0 ? "positive" : expDiff > 0 ? "negative" : "";
 
    document.getElementById("lastBalance").textContent = formatMoney(old.balance);
    document.getElementById("thisBalance").textContent = formatMoney(cur.balance);
    var balDiff = cur.balance - old.balance;
    var balEl = document.getElementById("changeBalance");
    balEl.textContent = formatDiff(balDiff);
    balEl.className = balDiff > 0 ? "positive" : balDiff < 0 ? "negative" : "";
}
 
// ---------- Udhaar (Lend / Borrow) ----------
uType.addEventListener("change", function () {
    if (this.value === "lent") {
        document.getElementById("uNameLabel").textContent = "Who did you give it to?";
        document.getElementById("uDueLabel").textContent = "They will return it by";
    } else {
        document.getElementById("uNameLabel").textContent = "Who did you take it from?";
        document.getElementById("uDueLabel").textContent = "You will return it by";
    }
});
 
function resetUdhaarForm() {
    editingUdhaarId = null;
    udhaarForm.reset();
    uDate.value = todayString();
    uDue.value = todayString();
    document.getElementById("udhaarFormTitle").textContent = "Add Udhaar";
    document.getElementById("uSubmit").textContent = "+ Add Udhaar";
    document.getElementById("uCancel").classList.add("hidden");
    document.getElementById("uNameLabel").textContent = "Who did you give it to?";
    document.getElementById("uDueLabel").textContent = "They will return it by";
}
 
document.getElementById("uCancel").addEventListener("click", resetUdhaarForm);
 
udhaarForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var item = {
        id: editingUdhaarId || Date.now(),
        type: uType.value,
        name: uName.value.trim(),
        amount: round2(parseFloat(uAmount.value)),
        date: uDate.value,
        due: uDue.value,
        remind: parseInt(uRemind.value, 10),
        note: uNote.value.trim(),
        rate: parseFloat(uRate.value) || 0,
        rateUnit: uRateUnit.value,
        interestType: uInterestType.value,
        settled: false
    };
 
    if (editingUdhaarId) {
        for (var i = 0; i < udhaarItems.length; i++) {
            if (udhaarItems[i].id === editingUdhaarId) {
                item.settled = udhaarItems[i].settled;
                if (udhaarItems[i].settledOn) {
                    item.settledOn = udhaarItems[i].settledOn;
                }
                udhaarItems[i] = item;
                break;
            }
        }
        showToast("Udhaar updated!");
    } else {
        udhaarItems.unshift(item);
        showToast("Udhaar added!");
    }
 
    saveUdhaar();
    resetUdhaarForm();
    renderUdhaar();
});
 
document.getElementById("udhaarTabs").addEventListener("click", function (e) {
    var btn = e.target.closest(".switch-btn");
    if (!btn) return;
    document.querySelectorAll("#udhaarTabs .switch-btn").forEach(function (b) {
        b.classList.remove("active");
    });
    btn.classList.add("active");
    udhaarFilter = btn.getAttribute("data-filter");
    renderUdhaar();
});
 
function renderUdhaar() {
    var list = document.getElementById("udhaarList");
    var empty = document.getElementById("udhaarEmpty");
    list.innerHTML = "";
 
    var toReceive = 0;
    var toPay = 0;
    var reminderCount = 0;
    var todayStr = todayString();
 
    var receiveInterest = 0;
    var payInterest = 0;
 
    udhaarItems.forEach(function (item) {
        if (!item.settled) {
            var interestNow = calcInterest(item);
            if (item.type === "lent") {
                toReceive += item.amount + interestNow;
                receiveInterest += interestNow;
            } else {
                toPay += item.amount + interestNow;
                payInterest += interestNow;
            }
 
            var daysLeft = daysBetween(todayStr, item.due);
            if (daysLeft <= item.remind) {
                reminderCount++;
            }
        }
    });
 
    document.getElementById("toReceive").textContent = formatMoney(round2(toReceive));
    document.getElementById("toPay").textContent = formatMoney(round2(toPay));
    document.getElementById("toReceiveNote").textContent =
        receiveInterest > 0 ? "Includes " + formatMoney(round2(receiveInterest)) + " interest" : "Money others owe you";
    document.getElementById("toPayNote").textContent =
        payInterest > 0 ? "Includes " + formatMoney(round2(payInterest)) + " interest" : "Money you owe others";
 
    var badge = document.getElementById("udhaarBadge");
    badge.textContent = reminderCount;
    badge.classList.toggle("hidden", reminderCount === 0);
 
    var filtered = udhaarItems.filter(function (item) {
        if (udhaarFilter === "pending") return !item.settled;
        if (udhaarFilter === "settled") return item.settled;
        return !item.settled && item.type === udhaarFilter;
    });
 
    if (filtered.length === 0) {
        empty.textContent = "No udhaar entries in this tab.";
        empty.classList.remove("hidden");
        return reminderCount;
    }
    empty.classList.add("hidden");
 
    filtered.forEach(function (item) {
        var row = makeEl("div", "u-item" + (item.settled ? " done" : ""));
        var avatar = makeEl("div", "u-avatar " + (item.type === "lent" ? "gave" : "took"), item.name.charAt(0).toUpperCase());
 
        var info = makeEl("div", "u-info");
        info.appendChild(makeEl("strong", "", item.name));
        info.appendChild(makeEl("small", "", (item.type === "lent" ? "Gave on " : "Took on ") + shortDate(item.date)));
        var interest = calcInterest(item);
        if (item.rate > 0) {
            info.appendChild(makeEl("small", "u-interest", rateLabel(item)));
        }
        if (item.note) {
            info.appendChild(makeEl("small", "u-note", "“" + item.note + "”"));
        }
 
        var amtBox = makeEl("div", "u-amount");
        var amtSpan = makeEl("span", item.type === "lent" ? "positive" : "negative", formatMoney(round2(item.amount + interest)));
        amtBox.appendChild(amtSpan);
        if (item.rate > 0) {
            amtBox.appendChild(makeEl("small", "", "Principal " + formatMoney(item.amount) + " + Interest " + formatMoney(interest)));
        }
        amtBox.appendChild(makeEl("small", "", "Due: " + shortDate(item.due)));
 
        var statusBox = makeEl("div", "u-status");
        var daysLeft = daysBetween(todayStr, item.due);
        var chip;
        if (item.settled) {
            chip = makeEl("span", "chip settled", "Settled");
        } else if (daysLeft < 0) {
            chip = makeEl("span", "chip overdue", "Overdue by " + Math.abs(daysLeft) + "d");
        } else if (daysLeft === 0) {
            chip = makeEl("span", "chip due", "Due today");
        } else if (daysLeft <= item.remind) {
            chip = makeEl("span", "chip due", "Due in " + daysLeft + "d");
        } else {
            chip = makeEl("span", "chip later", "Due in " + daysLeft + "d");
        }
        statusBox.appendChild(chip);
 
        var actions = makeEl("div", "u-actions");
        var settleBtn = makeEl("button", "action-btn done-btn", item.settled ? "Reopen" : "Mark Settled");
        settleBtn.type = "button";
        settleBtn.onclick = function () {
            item.settled = !item.settled;
            if (item.settled) {
                item.settledOn = todayString();
            } else {
                delete item.settledOn;
            }
            saveUdhaar();
            renderUdhaar();
        };
 
        var editBtn = makeEl("button", "action-btn", "Edit");
        editBtn.type = "button";
        editBtn.onclick = function () {
            editingUdhaarId = item.id;
            uType.value = item.type;
            uType.dispatchEvent(new Event("change"));
            uName.value = item.name;
            uAmount.value = item.amount;
            uDate.value = item.date;
            uDue.value = item.due;
            uRemind.value = item.remind;
            uNote.value = item.note;
            uRate.value = item.rate || 0;
            uRateUnit.value = item.rateUnit || "month";
            uInterestType.value = item.interestType || "simple";
            document.getElementById("udhaarFormTitle").textContent = "Edit Udhaar";
            document.getElementById("uSubmit").textContent = "Save Changes";
            document.getElementById("uCancel").classList.remove("hidden");
            udhaarForm.scrollIntoView({ behavior: "smooth" });
        };
 
        var delBtn = makeEl("button", "action-btn delete-btn", "Delete");
        delBtn.type = "button";
        delBtn.onclick = function () {
            udhaarItems = udhaarItems.filter(function (u) { return u.id !== item.id; });
            saveUdhaar();
            renderUdhaar();
            showToast("Udhaar deleted.");
        };
 
        actions.appendChild(settleBtn);
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);
 
        row.appendChild(avatar);
        row.appendChild(info);
        row.appendChild(amtBox);
        row.appendChild(statusBox);
        row.appendChild(actions);
        list.appendChild(row);
    });
 
    return reminderCount;
}
 
// ---------- Calculator ----------
var calcExprStr = "";
var calcResEl = document.getElementById("calcResult");
var calcExprEl = document.getElementById("calcExpr");
 
document.getElementById("calcKeys").addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    var key = btn.getAttribute("data-key");
 
    calcResEl.classList.remove("calc-error");
 
    if (key === "C") {
        calcExprStr = "";
        calcExprEl.textContent = "";
        calcResEl.textContent = "0";
    } else if (key === "⌫") {
        calcExprStr = calcExprStr.slice(0, -1);
        calcResEl.textContent = calcExprStr || "0";
    } else if (key === "=") {
        if (!calcExprStr) return;
        try {
            var clean = calcExprStr
                .replace(/×/g, "*")
                .replace(/÷/g, "/")
                .replace(/−/g, "-")
                .replace(/%/g, "/100");
            var val = Function('"use strict";return (' + clean + ')')();
            if (!isFinite(val)) throw new Error();
            calcExprEl.textContent = calcExprStr + " =";
            calcExprStr = String(round2(val));
            calcResEl.textContent = calcExprStr;
        } catch (err) {
            calcResEl.textContent = "Invalid Expression";
            calcResEl.classList.add("calc-error");
            calcExprStr = "";
        }
    } else {
        calcExprStr += key;
        calcResEl.textContent = calcExprStr;
    }
});
 
document.getElementById("calcUse").addEventListener("click", function () {
    var num = parseFloat(calcResEl.textContent);
    if (!isNaN(num) && num > 0) {
        showView("main");
        amountInput.value = round2(num);
        amountInput.focus();
        showToast("Amount copied to form!");
    } else {
        showToast("Calculate a valid positive number first.");
    }
});
 
// ---------- Settings Logic ----------
var currencySelect = document.getElementById("currencySelect");
currencySelect.value = currentCurrency;
 
currencySelect.addEventListener("change", function () {
    currentCurrency = this.value;
    localStorage.setItem("fintrackCurrency", currentCurrency);
    updateDashboard();
    renderTransactions();
    renderUdhaar();
    showToast("Currency changed to " + currentCurrency);
});
 
document.getElementById("openProfileFromSettings").addEventListener("click", openProfile);
 
document.getElementById("changePasswordForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var passwordForm = this;
    var newPass = document.getElementById("newPassword").value;
 
    if (newPass.length < 4) {
        alert("Password must be at least 4 characters.");
        return;
    }
 
    api("POST", "/api/password", { password: newPass }).then(function () {
        passwordForm.reset();
        showToast("✅ Password updated!");
    }).catch(function (err) {
        alert(err.message);
    });
});
 
document.getElementById("exportDataBtn").addEventListener("click", function () {
    var backup = {
        user: currentUser,
        exportedAt: new Date().toISOString(),
        transactions: transactions,
        udhaar: udhaarItems
    };
    var blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "FinTrack_" + currentUser + "_Backup.json";
    a.click();
    showToast("Backup downloaded!");
});
 
document.getElementById("resetDataBtn").addEventListener("click", function () {
    if (confirm("Are you sure? This will delete all your transactions and udhaar records permanently.")) {
        transactions = [];
        udhaarItems = [];
        saveData();
        saveUdhaar();
        renderTransactions();
        updateDashboard();
        renderUdhaar();
        showToast("All data reset.");
    }
});
 
// ---------- Reminders (device notifications) ----------
var swEnabled = false;
 
function setupReminders() {
    if (!("serviceWorker" in navigator)) {
        updateReminderStatus();
        return;
    }
    navigator.serviceWorker.register("/sw.js").then(function () {
        swEnabled = true;
        updateReminderStatus();
    }).catch(function () {
        updateReminderStatus();
    });
}
 
function showDeviceNotification(title, body, tag) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    var options = { body: body, tag: tag };
 
    if (swEnabled) {
        navigator.serviceWorker.ready.then(function (reg) {
            reg.showNotification(title, options);
        });
        return;
    }
    try {
        new Notification(title, options);
    } catch (err) {}
}
 
function remindedKey() {
    return "fintrackReminded_" + currentUser;
}
 
function loadReminded() {
    try {
        return JSON.parse(localStorage.getItem(remindedKey())) || {};
    } catch (err) {
        return {};
    }
}
 
function reminderMessage(item, daysLeft) {
    var amount = formatMoney(totalDue(item));
    var when;
    if (daysLeft < 0) {
        when = Math.abs(daysLeft) + " din se overdue hai";
    } else if (daysLeft === 0) {
        when = "aaj due hai";
    } else {
        when = daysLeft + " din baad due hai";
    }
 
    if (item.type === "lent") {
        return item.name + " se " + amount + " lene hain - " + when;
    }
    return item.name + " ko " + amount + " dene hain - " + when;
}
 
// Har pending udhaar ke liye din mein ek baar notification bhejta hai
function checkReminders() {
    if (!currentUser) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
 
    var todayStr = todayString();
    var reminded = loadReminded();
    var changed = false;
 
    udhaarItems.forEach(function (item) {
        if (item.settled) return;
 
        var daysLeft = daysBetween(todayStr, item.due);
        if (daysLeft > item.remind) return;
        if (reminded[item.id] === todayStr) return;
 
        var title = item.type === "lent" ? "💰 Udhaar wapas lene ka reminder" : "⏰ Udhaar chukane ka reminder";
        showDeviceNotification(title, reminderMessage(item, daysLeft), "udhaar-" + item.id);
 
        reminded[item.id] = todayStr;
        changed = true;
    });
 
    if (changed) {
        localStorage.setItem(remindedKey(), JSON.stringify(reminded));
    }
}
 
function updateReminderStatus() {
    var status = document.getElementById("reminderStatus");
    var btn = document.getElementById("enableReminderBtn");
 
    if (!("Notification" in window)) {
        status.textContent = "Is browser mein notifications support nahi hain";
        btn.classList.add("hidden");
        return;
    }
 
    btn.classList.remove("hidden");
    if (Notification.permission === "granted") {
        status.textContent = "ON ✅ - is device par reminders aayenge";
        btn.textContent = "Send test";
    } else if (Notification.permission === "denied") {
        status.textContent = "Blocked ❌ - browser settings mein Allow karo";
        btn.textContent = "How to fix";
    } else {
        status.textContent = "OFF - is device par reminders chalu karo";
        btn.textContent = "Enable";
    }
}
 
document.getElementById("enableReminderBtn").addEventListener("click", function () {
    if (!("Notification" in window)) return;
 
    if (Notification.permission === "denied") {
        alert("Notifications blocked hain.\n\nAddress bar ke lock icon par click karo -> Notifications -> Allow, phir page refresh karo.");
        return;
    }
 
    if (Notification.permission === "granted") {
        showDeviceNotification("FinTrack test ✅", "Reminders is device par sahi se kaam kar rahe hain.", "fintrack-test");
        return;
    }
 
    Notification.requestPermission().then(function () {
        updateReminderStatus();
        if (Notification.permission === "granted") {
            showDeviceNotification("FinTrack reminders ON ✅", "Ab udhaar due hone par yahan notification aayega.", "fintrack-test");
            checkReminders();
        }
    });
});
 
setupReminders();
setInterval(checkReminders, 60000);
 
// ---------- Auto Login Check on Page Load ----------
var savedUser = localStorage.getItem("fintrackCurrentUser");
if (savedUser && authToken) {
    currentUser = savedUser;
    showApp();
} else {
    showLoginPage();
}