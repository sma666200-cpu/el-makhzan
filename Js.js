import { 
    initializeApp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import { 
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager, 
    collection, 
    addDoc, 
    getDocs, 
    updateDoc, 
    doc, 
    onSnapshot, 
    setDoc, 
    query, 
    where, 
    increment, 
    serverTimestamp,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

/**
 * 💡 [الإعدادات]
 */
const firebaseConfig = {
    apiKey: "AIzaSyDVXDtVL4ZY69mT6qPH3b2QwGc6TWeLDJM",
    authDomain: "shaymaa-c1ead.firebaseapp.com",
    projectId: "shaymaa-c1ead",
    storageBucket: "shaymaa-c1ead.firebasestorage.app",
    messagingSenderId: "729029830623",
    appId: "1:729029830623:web:581f5e8c69c56cfc44c66a",
    measurementId: "G-0GXBVM2WRQ"
};

const app = initializeApp(firebaseConfig);

const db = initializeFirestore(
    app, 
    { 
        localCache: persistentLocalCache({ 
            tabManager: persistentMultipleTabManager() 
        }) 
    }
);

const auth = getAuth(app);

window.currentUser = ""; 
window.userRole = ""; 
window.userShift = "";

window.products = []; 
window.dailyMovements = []; 
window.shortageArchive = []; 
window.returnsList = []; 
window.factoryOrders = [];

const todayDateStr = new Date().toLocaleDateString('en-GB');

document.documentElement.setAttribute('data-theme', 'light');

window.toggleTheme = () => {
    let currentTheme = document.documentElement.getAttribute('data-theme');
    
    if (currentTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'light');
        document.getElementById('theme-icon').innerText = '🌙';
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('theme-icon').innerText = '☀️';
    }
};

window.encodeUsernameForEmail = (username) => {
    let hex = "";
    
    for (let i = 0; i < username.length; i++) {
        hex += username.charCodeAt(i).toString(16);
    }
    
    return "user_" + hex;
};

/**
 * 💡 [الحفاظ على الجلسة عند الريفريش]
 */
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const savedUser = localStorage.getItem('erp_username');
        
        if (savedUser) {
            const qSnap = await getDocs(
                query(
                    collection(db, "users"), 
                    where("username", "==", savedUser)
                )
            );
            
            if (!qSnap.empty) {
                let data = qSnap.docs[0].data();
                
                window.currentUser = data.username; 
                window.userRole = data.role; 
                window.userShift = data.shift;
                
                if (data.role === 'admin') {
                    document.getElementById('display-manager').innerText = `${data.username} (${data.shift})`;
                    document.getElementById('admin-only-sidebar-items').style.display = 'block';
                    document.getElementById('btn-add-storekeeper').style.display = 'inline-flex';
                } else {
                    document.getElementById('display-manager').innerText = `${data.username} (أمين مخزن)`;
                    document.getElementById('admin-only-sidebar-items').style.display = 'none';
                    document.getElementById('btn-add-storekeeper').style.display = 'none';
                }
                
                document.getElementById('login-section').classList.add('hidden');
                document.getElementById('dashboard-section').classList.remove('hidden');
                
            }
        }
    }
});

/**
 * 💡 [المصانع]
 */
window.suppliersDB = [
    { 
        keywords: [
            "سكر", 
            "جلوكوز", 
            "سكر بودرة"
        ], 
        factory: "شركة الحوامدية للصناعات التكاملية", 
        email: "sales@hawamdia.com", 
        contact: "02-38111111" 
    },
    { 
        keywords: [
            "رز", 
            "أرز", 
            "ارز"
        ], 
        factory: "مضارب الأرز المصرية", 
        email: "orders@rice-egypt.com", 
        contact: "050-2222222" 
    },
    { 
        keywords: [
            "زيت", 
            "سمنة", 
            "زيوت"
        ], 
        factory: "شركة أرما للزيوت", 
        email: "sales@arma.com.eg", 
        contact: "16000" 
    },
    { 
        keywords: [
            "حديد", 
            "اسمنت"
        ], 
        factory: "مجموعة عز / السويس", 
        email: "sales@ezzsteel.com", 
        contact: "19000" 
    }
];

window.findSupplierForProduct = (productName) => {
    let searchName = productName.toLowerCase();
    
    return window.suppliersDB.find(
        supplier => supplier.keywords.some(
            keyword => searchName.includes(keyword)
        )
    ) || null;
};

/**
 * 💡 [تحديث أسعار السوق من قبل المدير]
 */
window.updateProductPrice = async (docId) => {
    const newPriceInput = document.getElementById(`new-price-${docId}`);
    const newPriceValue = parseInt(newPriceInput.value);
    
    if (!newPriceValue || isNaN(newPriceValue) || newPriceValue <= 0) {
        return window.showToast("يرجى إدخال سعر صحيح!", "error");
    }
    
    try {
        await updateDoc(
            doc(db, "products", docId), 
            { 
                price: newPriceValue 
            }
        );
        
        window.showToast("تم تحديث السعر وتوزيعه بنجاح!", "success");
        
    } catch(e) {
        window.showToast("حدث خطأ أثناء تحديث السعر", "error");
    }
};

/**
 * 💡 [الكاميرا والاسكانر]
 */
let html5QrCode = null;
let currentTargetInput = null;

window.startScanner = (inputId) => {
    currentTargetInput = inputId;
    
    const scannerElement = document.getElementById('scanner-modal');
    if (scannerElement) {
        scannerElement.style.zIndex = "9999";
    }
    
    window.openModal('scanner-modal');
    
    setTimeout(() => {
        if (!html5QrCode) {
            html5QrCode = new Html5Qrcode("reader");
        }
        
        html5QrCode.start(
            { 
                facingMode: "environment" 
            }, 
            { 
                fps: 10, 
                qrbox: { width: 250, height: 250 } 
            },
            (decodedText) => {
                const inputField = document.getElementById(currentTargetInput);
                
                inputField.value = decodedText;
                inputField.dispatchEvent(new Event('input'));
                
                window.stopScanner();
                window.showToast("تم قراءة الباركود بنجاح!", "success");
            },
            (errorMessage) => { 
                
            }
        ).catch((err) => {
            window.showToast("يرجى إعطاء صلاحية الكاميرا للمتصفح.", "error");
        });
    }, 500); 
};

window.stopScanner = () => {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            window.closeModal('scanner-modal');
        }).catch(err => {
            window.closeModal('scanner-modal');
        });
    } else {
        window.closeModal('scanner-modal');
    }
};

window.previewImage = (event) => {
    const file = event.target.files[0];
    
    if (file) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const imgPreview = document.getElementById('image-preview');
            
            imgPreview.src = e.target.result;
            imgPreview.style.display = 'block';
            imgPreview.style.maxWidth = '100px';
            imgPreview.style.marginTop = '10px';
            imgPreview.style.borderRadius = '8px';
        }
        
        reader.readAsDataURL(file);
    }
};

window.toggleSidebar = () => {
    document.getElementById('app-sidebar').classList.toggle('active');
};

window.showTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(t => { 
        t.classList.add('hidden'); 
    });
    
    document.querySelectorAll('.tab-btn').forEach(b => { 
        b.classList.remove('active'); 
    });
    
    document.getElementById(tabId).classList.remove('hidden');
    event.currentTarget.classList.add('active');
    
    if (window.innerWidth <= 768) {
        document.getElementById('app-sidebar').classList.remove('active');
    }
};

window.openModal = (id) => { 
    const m = document.getElementById(id); 
    
    if (m) { 
        m.classList.remove('hidden'); 
        
        setTimeout(() => { 
            m.classList.add('active'); 
        }, 10); 
        
        if (id === 'dispense-modal') {
            setTimeout(() => { 
                document.getElementById('disp-name').focus(); 
            }, 100);
        }
        
        if (window.innerWidth <= 768) {
            document.getElementById('app-sidebar').classList.remove('active');
        }
    }
};

window.closeModal = (id) => { 
    const m = document.getElementById(id); 
    
    if (m) { 
        m.classList.remove('active'); 
        
        setTimeout(() => { 
            m.classList.add('hidden'); 
        }, 300); 
    } 
};

window.showToast = (msg, type = 'success') => { 
    const c = document.getElementById('toast-container');
    const t = document.createElement('div'); 
    
    t.className = `toast ${type}`; 
    t.innerText = msg; 
    
    c.appendChild(t); 
    
    setTimeout(() => { 
        t.style.opacity = 1; 
    }, 10); 
    
    setTimeout(() => { 
        t.style.opacity = 0; 
        
        setTimeout(() => { 
            t.remove(); 
        }, 400); 
        
    }, 3000); 
};

/**
 * 💡 [التسجيل والمصادقة]
 */
window.registerUser = async (role) => {
    const userField = role === 'admin' ? 'reg-admin-user' : 'storekeeper-user';
    const passField = role === 'admin' ? 'reg-admin-pass' : 'storekeeper-pass';
    
    const username = document.getElementById(userField).value.trim();
    const password = document.getElementById(passField).value.trim();
    
    let shift = role === 'admin' ? document.getElementById('reg-admin-shift').value : "";

    if (!username || !password || (role === 'admin' && !shift)) {
        return window.showToast("يرجى إكمال جميع البيانات!", "error");
    }
    
    if (password.length < 6) {
        return window.showToast("خطأ: كلمة المرور يجب ألا تقل عن 6 أرقام أو حروف!", "error");
    }

    const safeEmailPrefix = window.encodeUsernameForEmail(username);

    try {
        await createUserWithEmailAndPassword(
            auth, 
            `${safeEmailPrefix}@mastech.com`, 
            password
        );
        
        await setDoc(
            doc(db, "users", username), 
            { 
                username: username, 
                role: role, 
                shift: shift || "أمين مخزن", 
                createdAt: serverTimestamp() 
            }
        );
        
        window.showToast("تم حفظ البيانات بنجاح!", "success");
        window.closeModal(role === 'admin' ? 'register-admin-modal' : 'add-storekeeper-modal');
        
    } catch (e) { 
        window.showToast("خطأ أثناء التسجيل: تأكد أن الاسم غير مستخدم", "error"); 
    }
};

window.login = async () => {
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value.trim();
    
    if (!u || !p) {
        return window.showToast("أدخل بيانات الدخول", "error");
    }

    const safeEmailPrefix = window.encodeUsernameForEmail(u);

    try {
        await signInWithEmailAndPassword(
            auth, 
            `${safeEmailPrefix}@mastech.com`, 
            p
        );
        
        const qSnap = await getDocs(
            query(
                collection(db, "users"), 
                where("username", "==", u)
            )
        );
        
        if (!qSnap.empty) {
            let data = qSnap.docs[0].data();
            
            window.currentUser = data.username; 
            window.userRole = data.role; 
            window.userShift = data.shift;
            
            localStorage.setItem('erp_username', data.username);
            
            if (data.role === 'admin') {
                document.getElementById('display-manager').innerText = `${data.username} (${data.shift})`;
                document.getElementById('admin-only-sidebar-items').style.display = 'block';
                document.getElementById('btn-add-storekeeper').style.display = 'inline-flex';
            } else {
                document.getElementById('display-manager').innerText = `${data.username} (أمين مخزن)`;
                document.getElementById('admin-only-sidebar-items').style.display = 'none';
                document.getElementById('btn-add-storekeeper').style.display = 'none';
            }
            
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('dashboard-section').classList.remove('hidden');
            
        }
    } catch (e) { 
        window.showToast("اسم المستخدم أو كلمة المرور غير صحيحة", "error"); 
    }
};

window.logout = async () => { 
    localStorage.removeItem('erp_username');
    await signOut(auth); 
    location.reload(); 
};

/**
 * 💡 [توليد الباركود]
 */
window.generateBarcode = () => {
    const randomCode = Math.floor(Math.random() * 900000000000) + 100000000000;
    
    document.getElementById('inc-code').value = randomCode;
    
    window.showToast("تم توليد باركود آلي بنجاح 🎲", "success");
    
    document.getElementById('inc-name').focus();
};

window.printProductBarcode = (code, name, price) => {
    document.getElementById('barcode-name-val').innerText = name;
    document.getElementById('barcode-price-val').innerText = "السعر: " + price + " ج.م";
    
    JsBarcode(
        "#barcode-svg", 
        code, 
        { 
            format: "CODE128", 
            displayValue: true, 
            height: 50, 
            fontSize: 16, 
            margin: 10 
        }
    );
    
    document.body.classList.add('printing-barcode');
    
    window.print();
    
    setTimeout(() => { 
        document.body.classList.remove('printing-barcode'); 
    }, 1000);
};

/**
 * 💡 [طلبات المصانع وربط الإيميل الحقيقي]
 */
window.openFactoryOrderModal = (productName = '') => { 
    document.getElementById('po-product-name').value = productName; 
    
    window.openModal('factory-order-modal'); 
};

window.submitFactoryOrder = async () => {
    const name = document.getElementById('po-product-name').value.trim(); 
    const qty = document.getElementById('po-qty').value;
    const unit = document.getElementById('po-unit').value; 
    const address = document.getElementById('po-warehouse-address').value.trim();
    const userPhone = document.getElementById('po-user-phone').value.trim();
    
    if (!name || !qty || !address || !userPhone) {
        return window.showToast("يرجى إكمال بيانات الطلب ورقم الهاتف!", "error");
    }
    
    let supplier = window.findSupplierForProduct(name);
    let targetEmail = supplier ? supplier.email : "sales@factory.com";
    let fName = supplier ? supplier.factory : "بحث في السوق الحر";
    
    try {
        await addDoc(
            collection(db, "factory_orders"), 
            { 
                product: name, 
                qty: qty, 
                unit: unit, 
                address: address, 
                userPhone: userPhone, 
                factory: fName, 
                contact: supplier ? supplier.contact : "سيتم المتابعة لاحقاً", 
                status: "جاري التجهيز ⏳", 
                timestamp: serverTimestamp(), 
                orderedBy: window.currentUser 
            }
        );
        
        window.showToast("تم حفظ الطلب في النظام", "success"); 
        window.closeModal('factory-order-modal');

        const subject = encodeURIComponent(`طلب توريد جديد من مخازن ${window.currentUser}`);
        const body = encodeURIComponent(`السادة مصنع / ${fName}\n\nنرجو توريد الآتي:\nالمنتج: ${name}\nالكمية: ${qty} ${unit}\n\nاسم المخزن: MAS TECH ERP\nمسئول المخزن: ${window.currentUser}\nعنوان الاستلام: ${address}\nرقم التواصل: ${userPhone}\n\nوشكراً جزيلاً.`);
        
        window.location.href = `mailto:${targetEmail}?subject=${subject}&body=${body}`;

    } catch(e) { 
        window.showToast("حدث خطأ أثناء الطلب", "error"); 
    }
};

window.cancelFactoryOrder = async (orderId) => {
    try {
        await deleteDoc(
            doc(db, "factory_orders", orderId)
        );
        
        window.showToast("تم إلغاء الطلب ❌", "success");
        
    } catch(e) {
        window.showToast("حدث خطأ أثناء محاولة الإلغاء", "error");
    }
};

/**
 * 💡 [الوارد والصرف]
 */
window.addIncoming = async () => {
    const code = document.getElementById('inc-code').value.trim(); 
    const name = document.getElementById('inc-name').value.trim();
    const category = document.getElementById('inc-category').value;
    const price = parseInt(document.getElementById('inc-price').value) || 0; 
    const qty = parseInt(document.getElementById('inc-qty').value);
    const expiry = document.getElementById('inc-expiry').value || "دائم";

    if (!code || !name || !qty || isNaN(qty)) {
        return window.showToast("أكمل بيانات المنتج بشكل صحيح!", "error");
    }

    try {
        await setDoc(
            doc(db, "products", code), 
            { 
                code: code, 
                name: name, 
                category: category, 
                price: price, 
                qty: increment(qty), 
                expiry: expiry 
            }, 
            { 
                merge: true 
            }
        );
        
        await addMovementLog(
            code, 
            name, 
            "وارد 📥", 
            qty, 
            price, 
            "-", 
            "-"
        );
        
        window.showToast("تم إضافة الوارد بنجاح", "success"); 
        
        document.querySelectorAll('#incoming input:not([type="checkbox"])').forEach(i => { 
            i.value = ''; 
        });
        
    } catch (e) { 
        window.showToast("خطأ في الاتصال بقاعدة البيانات", "error"); 
    }
};

window.fetchProductForDispense = () => { 
    const code = document.getElementById('disp-code').value.trim(); 
    const product = window.products.find(p => p.code === code); 
    
    if (product) {
        document.getElementById('disp-name').value = product.name;
    }
};

window.fetchProductByNameForDispense = () => {
    const name = document.getElementById('disp-name').value.trim();
    const product = window.products.find(p => p.name === name);
    
    if (product) {
        document.getElementById('disp-code').value = product.code;
    }
};

window.submitDispense = async () => {
    const code = document.getElementById('disp-code').value.trim(); 
    const qty = parseInt(document.getElementById('disp-qty').value);
    const customerName = document.getElementById('disp-customer').value.trim() || "غير مسجل";
    const customerPhone = document.getElementById('disp-phone').value.trim() || "لا يوجد";
    
    if (!code || !qty || isNaN(qty) || qty <= 0) {
        return window.showToast("حقول فارغة أو كمية غير صحيحة!", "error");
    }
    
    let product = window.products.find(p => p.code === code); 
    
    if (!product || product.qty < qty) {
        return window.showToast("رصيد المخزن غير كافي!", "error");
    }
    
    try {
        await updateDoc(
            doc(db, "products", product.id), 
            { 
                qty: increment(-qty) 
            }
        );
        
        await addMovementLog(
            code, 
            product.name, 
            "منصرف 📤", 
            qty, 
            product.price, 
            customerName, 
            customerPhone
        );
        
        if (product.qty - qty <= 0) {
            await setDoc(
                doc(db, "archive", code), 
                { 
                    ...product, 
                    qty: 0, 
                    status: "نفذت الكمية 🔴" 
                }
            );
        }
        
        window.showToast("تم صرف الفاتورة بنجاح", "success"); 
        
        document.getElementById('disp-code').value = '';
        document.getElementById('disp-name').value = '';
        document.getElementById('disp-customer').value = '';
        document.getElementById('disp-phone').value = '';
        document.getElementById('disp-qty').value = '';
        
        window.closeModal('dispense-modal');
        
    } catch(e) { 
        window.showToast("خطأ أثناء الصرف", "error"); 
    }
};

/**
 * 💡 [المرتجعات]
 */
window.autoFillReturn = () => { 
    const code = document.getElementById('ret-code').value.trim(); 
    const product = window.products.find(p => p.code === code); 
    
    if (product) {
        document.getElementById('ret-name').value = product.name;
    } else {
        document.getElementById('ret-name').value = "إضافة كجديد";
    }
};

window.addReturn = async () => {
    const code = document.getElementById('ret-code').value.trim(); 
    const customer = document.getElementById('ret-customer').value.trim();
    const qty = parseInt(document.getElementById('ret-qty').value); 
    const reason = document.getElementById('ret-reason').value.trim();
    const nameInput = document.getElementById('ret-name').value;
    
    if (!code || !qty || !customer) {
        return window.showToast("بيانات المرتجع غير مكتملة!", "error");
    }
    
    try {
        let product = window.products.find(p => p.code === code); 
        let pName = product ? product.name : (nameInput !== "إضافة كجديد" ? nameInput : "مرتجع مجهول");
        
        if (product) {
            await updateDoc(
                doc(db, "products", product.id), 
                { 
                    qty: increment(qty) 
                }
            );
        } else {
            await setDoc(
                doc(db, "products", code), 
                { 
                    code: code, 
                    name: pName, 
                    category: "أخرى", 
                    price: 0, 
                    qty: qty, 
                    expiry: "مراجعة" 
                }
            );
        }
        
        await addDoc(
            collection(db, "returns"), 
            { 
                code: code, 
                name: pName, 
                customer: customer, 
                qty: qty, 
                reason: reason, 
                timestamp: serverTimestamp() 
            }
        );
        
        await addMovementLog(
            code, 
            pName, 
            "مرتجع 🔙", 
            qty, 
            product ? product.price : 0, 
            customer, 
            "غير مسجل"
        );
        
        window.showToast("تم تسجيل المرتجع بنجاح.", "success"); 
        
        document.querySelectorAll('#returns input').forEach(i => { 
            i.value = ''; 
        });
        
    } catch(e) { 
        window.showToast("خطأ أثناء الإرجاع", "error"); 
    }
};

async function addMovementLog(code, name, type, qty, price, receiverName, receiverPhone) {
    let identifier = window.userRole === 'admin' ? `${window.currentUser} (${window.userShift})` : `${window.currentUser} (أمين مخزن)`;
    
    await addDoc(
        collection(db, "movements"), 
        { 
            date: todayDateStr, 
            time: new Date().toLocaleTimeString('ar-EG'), 
            code: code, 
            name: name, 
            type: type, 
            qty: qty, 
            price: price, 
            employee: identifier, 
            receiverName: receiverName, 
            receiverPhone: receiverPhone,
            timestamp: serverTimestamp() 
        }
    );
}

/**
 * 💡 [التحديث اللحظي للبيانات]
 */
onSnapshot(
    collection(db, "products"), 
    (snapshot) => { 
        window.products = []; 
        snapshot.forEach(doc => { 
            window.products.push(
                { 
                    id: doc.id, 
                    ...doc.data() 
                }
            ); 
        }); 
        updateUI(); 
    }
);

onSnapshot(
    collection(db, "movements"), 
    (snapshot) => { 
        window.dailyMovements = []; 
        snapshot.forEach(doc => { 
            let data = doc.data(); 
            if (data.date === todayDateStr) { 
                window.dailyMovements.push(
                    { 
                        id: doc.id, 
                        ...data 
                    }
                ); 
            }
        }); 
        updateUI(); 
    }
);

onSnapshot(
    collection(db, "returns"), 
    (snapshot) => { 
        window.returnsList = []; 
        snapshot.forEach(doc => { 
            window.returnsList.push(
                { 
                    id: doc.id, 
                    ...doc.data() 
                }
            ); 
        }); 
        updateUI(); 
    }
);

onSnapshot(
    collection(db, "archive"), 
    (snapshot) => { 
        window.shortageArchive = []; 
        snapshot.forEach(doc => { 
            window.shortageArchive.push(
                { 
                    id: doc.id, 
                    ...doc.data() 
                }
            ); 
        }); 
        updateUI(); 
    }
);

onSnapshot(
    collection(db, "factory_orders"), 
    (snapshot) => { 
        window.factoryOrders = []; 
        snapshot.forEach(doc => { 
            window.factoryOrders.push(
                { 
                    id: doc.id, 
                    ...doc.data() 
                }
            ); 
        }); 
        updateUI(); 
    }
);

window.updateUI = () => {
    
    document.getElementById('stat-total-products').innerText = window.products.length;
    document.getElementById('stat-total-returns').innerText = window.returnsList.length;
    document.getElementById('stat-total-archive').innerText = window.shortageArchive.length;
    
    const dataList = document.getElementById('products-list');
    
    if (dataList) {
        dataList.innerHTML = '';
        window.products.forEach(p => {
            dataList.innerHTML += `
                <option value="${p.name}">
            `;
        });
    }

    const marketTbody = document.getElementById('market-pricing-tbody'); 
    
    if (marketTbody) {
        marketTbody.innerHTML = '';
        
        window.products.forEach(p => { 
            marketTbody.innerHTML += `
                <tr>
                    <td>
                        ${p.code}
                    </td>
                    <td>
                        ${p.name}
                    </td>
                    <td>
                        <strong style="color:var(--primary);">
                            ${p.price}
                        </strong>
                    </td>
                    <td>
                        <input 
                            type="number" 
                            id="new-price-${p.id}" 
                            placeholder="السعر..." 
                            style="width: 90px; padding: 6px; border-radius: 6px; border: 1px solid var(--border); background: var(--input-bg); color: var(--light-text);"
                        >
                    </td>
                    <td>
                        <button 
                            onclick="updateProductPrice('${p.id}')" 
                            class="btn-success" 
                            style="padding: 6px 12px; font-size: 12px;"
                        >
                            تحديث السعر
                        </button>
                    </td>
                </tr>
            `; 
        });
    }

    const ordersTbody = document.getElementById('factory-orders-tbody'); 
    
    if (ordersTbody) {
        ordersTbody.innerHTML = '';
        window.factoryOrders.forEach(o => { 
            ordersTbody.innerHTML += `
                <tr>
                    <td>
                        ${o.product}
                    </td>
                    <td>
                        <strong style="color:var(--primary);">
                            ${o.qty} ${o.unit}
                        </strong>
                    </td>
                    <td>
                        🏭 ${o.factory}
                    </td>
                    <td style="font-size: 13px;">
                        📞 المصنع: ${o.contact}
                        <br>
                        <span style="color:var(--muted-text)">
                            📱 رقمك: ${o.userPhone || ''}
                        </span>
                    </td>
                    <td style="color:var(--warning); font-weight:bold;">
                        ${o.status}
                    </td>
                    <td>
                        <button 
                            onclick="cancelFactoryOrder('${o.id}')" 
                            class="btn-danger" 
                            style="padding: 6px 10px; font-size: 12px; border-radius: 6px;"
                        >
                            إلغاء ❌
                        </button>
                    </td>
                </tr>
            `; 
        });
    }

    const prodTbody = document.getElementById('products-tbody'); 
    const categoryFilterElement = document.getElementById('category-filter');
    const selectedCategory = categoryFilterElement ? categoryFilterElement.value : "الكل";
    
    if (prodTbody) {
        prodTbody.innerHTML = '';
        
        window.products.forEach(p => { 
            if (selectedCategory === "الكل" || p.category === selectedCategory) {
                prodTbody.innerHTML += `
                    <tr>
                        <td>
                            ${p.code}
                        </td>
                        <td style="color:var(--muted-text); font-size:12px;">
                            ${p.category || 'غير محدد'}
                        </td>
                        <td>
                            ${p.name}
                        </td>
                        <td>
                            <strong style="color:${p.qty > 0 ? 'var(--success)' : 'var(--danger)'}">
                                ${p.qty}
                            </strong>
                        </td>
                        <td>
                            ${p.price} ج.م
                        </td>
                        <td>
                            ${p.expiry || 'دائم'}
                        </td>
                        <td>
                            <button 
                                onclick="printProductBarcode('${p.code}', '${p.name}', '${p.price}')" 
                                class="btn-secondary" 
                                style="padding: 5px 10px; font-size: 12px;"
                            >
                                🖨️ باركود
                            </button>
                        </td>
                    </tr>
                `; 
            }
        });
    }

    const movTbody = document.getElementById('movement-tbody'); 
    
    if (movTbody) {
        movTbody.innerHTML = '';
        
        [...window.dailyMovements].sort(
            (a,b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)
        ).forEach(m => { 
            movTbody.innerHTML += `
                <tr>
                    <td>
                        ${m.time}
                    </td>
                    <td>
                        ${m.type}
                    </td>
                    <td>
                        ${m.name} (${m.code})
                    </td>
                    <td>
                        ${m.qty}
                    </td>
                    <td style="font-size:12px;">
                        ${m.receiverName || '-'}
                        <br>
                        <span style="color:gray">
                            ${m.receiverPhone || ''}
                        </span>
                    </td>
                    <td>
                        ${m.employee}
                    </td>
                </tr>
            `; 
        });
    }

    const retTbody = document.getElementById('returns-tbody'); 
    
    if (retTbody) {
        retTbody.innerHTML = '';
        
        window.returnsList.forEach(r => { 
            retTbody.innerHTML += `
                <tr>
                    <td>${r.code}</td>
                    <td>${r.customer}</td>
                    <td>${r.qty}</td>
                    <td>${r.reason}</td>
                </tr>
            `; 
        });
    }

    const archTbody = document.getElementById('archive-tbody'); 
    
    if (archTbody) {
        archTbody.innerHTML = '';
        
        window.shortageArchive.forEach(a => { 
            archTbody.innerHTML += `
                <tr>
                    <td>
                        ${a.code}
                    </td>
                    <td>
                        ${a.name}
                    </td>
                    <td style="color:var(--danger)">
                        ${a.status}
                    </td>
                    <td>
                        <button 
                            onclick="openFactoryOrderModal('${a.name}')" 
                            class="btn-primary" 
                            style="padding: 6px 12px; font-size: 12px;"
                        >
                            طلب سريع
                        </button>
                    </td>
                </tr>
            `; 
        });
    }
}

/**
 * 💡 [التقارير اليومية والمعاينة قبل الطباعة]
 */
window.generateDailyReport = () => { 
    
    let movementsRows = '';
    
    [...window.dailyMovements].sort(
        (a,b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)
    ).forEach(m => {
        movementsRows += `
            <tr>
                <td>${m.time}</td>
                <td>${m.type}</td>
                <td>${m.name}</td>
                <td>${m.qty}</td>
                <td>${m.receiverName || '-'}</td>
                <td>${m.receiverPhone || '-'}</td>
                <td>${m.employee}</td>
            </tr>
        `;
    });

    // تم إضافة حقول إدخال وتعديل زر الطباعة ليعمل عند الضغط بدلاً من الإغلاق التلقائي
    let reportHTML = `
        <html dir="rtl" lang="ar">
        <head>
            <title>معاينة التقرير اليومي - MAS TECH ERP</title>
            <style>
                body { 
                    font-family: 'Cairo', Tahoma, sans-serif; 
                    padding: 30px; 
                    background: #fff; 
                    color: #000; 
                }
                .header { 
                    text-align: center; 
                    border-bottom: 2px solid #000; 
                    padding-bottom: 10px; 
                    margin-bottom: 20px; 
                }
                h1 { 
                    color: #1d4ed8; 
                    margin: 0; 
                }
                h3 { 
                    color: #555; 
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-top: 20px; 
                    font-size: 14px; 
                }
                th, td { 
                    border: 1px solid #000; 
                    padding: 12px; 
                    text-align: center; 
                }
                th { 
                    background-color: #f1f5f9; 
                }
                .footer { 
                    margin-top: 40px; 
                    font-weight: bold; 
                    font-size: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                .input-line {
                    border: none;
                    border-bottom: 2px dashed #000;
                    font-family: 'Cairo', Tahoma, sans-serif;
                    font-size: 16px;
                    font-weight: bold;
                    width: 250px;
                    outline: none;
                    background: transparent;
                }
                .print-btn {
                    display: block;
                    width: 200px;
                    margin: 0 auto 20px auto;
                    padding: 10px;
                    background-color: #1d4ed8;
                    color: white;
                    text-align: center;
                    border: none;
                    border-radius: 8px;
                    font-size: 18px;
                    cursor: pointer;
                    font-family: 'Cairo', Tahoma, sans-serif;
                }
                /* إخفاء الزر أثناء الطباعة الورقية */
                @media print {
                    .print-btn { display: none !important; }
                    .input-line { border-bottom: none; }
                }
            </style>
        </head>
        <body>
            <button class="print-btn" onclick="window.print()">🖨️ طباعة التقرير</button>
            
            <div class="header">
                <h1>MAS TECH ERP</h1>
                <h3>تقرير العمليات وحركة المخزن اليومية</h3>
                <p>تاريخ التقرير: ${todayDateStr}</p>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>الوقت</th>
                        <th>نوع الحركة</th>
                        <th>اسم الصنف</th>
                        <th>الكمية</th>
                        <th>اسم المستلم/العميل</th>
                        <th>رقم هاتف المستلم</th>
                        <th>المسئول (أمين المخزن)</th>
                    </tr>
                </thead>
                <tbody>
                    ${movementsRows || '<tr><td colspan="7">لا توجد حركات مسجلة اليوم</td></tr>'}
                </tbody>
            </table>

            <div class="footer">
                <p>إجمالي الحركات اليوم: ${window.dailyMovements.length} حركة</p>
                <div>
                    <label>توقيع أمين المخزن: </label>
                    <input type="text" class="input-line" value="${window.currentUser}">
                </div>
                <div>
                    <label>اسم المستلم: </label>
                    <input type="text" class="input-line" placeholder="اكتب اسم المستلم هنا...">
                </div>
                <div>
                    <label>رقم هاتف المستلم: </label>
                    <input type="text" class="input-line" placeholder="اكتب رقم الهاتف هنا...">
                </div>
            </div>
        </body>
        </html>
    `;

    let printWin = window.open('', '', 'width=900,height=650');
    
    printWin.document.write(reportHTML);
    printWin.document.close();
    printWin.focus();
};
