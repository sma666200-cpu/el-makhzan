import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
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
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

/**
 * 💡 [خوارزمية / برومبت الإعدادات والربط]:
 * - الوظيفة: استدعاء مكتبات فايربيز وربط المشروع بقاعدة البيانات السحابية (Firestore) ونظام تسجيل الدخول (Auth).
 * - المميزات: تم تفعيل (persistentLocalCache) لضمان حفظ البيانات مؤقتاً وعمل التطبيق حتى لو الإنترنت ضعيف أو فاصل لحظياً.
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
const db = initializeFirestore(app, { 
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) 
});
const auth = getAuth(app);

/**
 * 💡 [خوارزمية / برومبت المتغيرات العامة (State Management)]:
 * - الوظيفة: إنشاء ذاكرة حية داخل التطبيق (متغيرات window) لحفظ بيانات الجلسة الحالية.
 * - الاستخدام: حفظ اسم الموظف، صلاحياته، المنتجات، الحركات اليومية، لسهولة وسرعة عرضها بدون تحميل متكرر.
 */
window.currentUser = ""; 
window.userRole = ""; 
window.userShift = "";

window.products = []; 
window.dailyMovements = []; 
window.shortageArchive = []; 
window.returnsList = []; 
window.factoryOrders = [];

const todayDateStr = new Date().toLocaleDateString('en-GB');

/**
 * 💡 [خوارزمية / برومبت نظام الإضاءة (Dark/Light Mode)]:
 * - الوظيفة: تغيير مظهر النظام (الثيم) بالكامل بين الوضع النهاري والليلي.
 * - الآلية: تقوم الدالة بقراءة الـ Attribute الموجود في عنصر الـ HTML، وعند الضغط يتم تبديله وتغيير الأيقونة.
 */
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

/**
 * 💡 [خوارزمية / برومبت قاعدة بيانات المصانع (المطابقة الذكية)]:
 * - الوظيفة: قاموس بيانات مدمج يربط الكلمات الدلالية للمنتجات (Keywords) بأسماء المصانع الموردة وأرقامهم.
 * - الآلية: دالة (findSupplierForProduct) تأخذ اسم المنتج المكتوب وتبحث عن أي كلمة مطابقة لجلب بيانات المصنع آلياً.
 */
window.suppliersDB = [
    { 
        keywords: ["سكر", "جلوكوز", "سكر بودرة"], 
        factory: "شركة الحوامدية للصناعات التكاملية", 
        contact: "02-38111111" 
    },
    { 
        keywords: ["رز", "أرز", "ارز"], 
        factory: "مضارب الأرز المصرية", 
        contact: "050-2222222" 
    },
    { 
        keywords: ["زيت", "سمنة", "زيوت"], 
        factory: "شركة أرما للزيوت", 
        contact: "16000" 
    },
    { 
        keywords: ["حديد", "اسمنت"], 
        factory: "مجموعة عز / السويس", 
        contact: "19000" 
    }
];

window.findSupplierForProduct = (productName) => {
    let searchName = productName.toLowerCase();
    return window.suppliersDB.find(supplier => 
        supplier.keywords.some(keyword => searchName.includes(keyword))
    ) || null;
};

/**
 * 💡 [خوارزمية / برومبت المزامنة مع السوق المحلي (Dynamic Pricing)]:
 * - الوظيفة: تحديث أسعار المنتجات في النظام بشكل ديناميكي لمحاكاة تغيرات الأسعار العالمية والمحلية.
 * - الآلية: تمر الخوارزمية على المنتجات وتطبق نسبة تغير عشوائية طفيفة (-5% إلى +5%) ثم تحفظها في الداتابيز.
 */
window.syncWithLocalMarket = async () => {
    const container = document.getElementById('market-status-container');
    if (container) {
        container.innerHTML = `
            <div style="background: rgba(245, 158, 11, 0.1); color: var(--warning); padding: 8px 15px; border-radius: 20px; font-size: 13px; font-weight: bold; border: 1px solid var(--warning);">
                ⏳ جاري مزامنة السوق...
            </div>
        `;
    }

    for (const product of window.products) {
        if (Math.random() > 0.7) { 
            let change = (Math.random() * 0.1) - 0.05; 
            let newMarketPrice = Math.round(product.price + (product.price * change));
            
            if (newMarketPrice !== product.price && newMarketPrice > 0) {
                await updateDoc(doc(db, "products", product.id), { 
                    price: newMarketPrice 
                });
            }
        }
    }

    if (container) {
        container.innerHTML = `
            <div style="background: rgba(16, 185, 129, 0.1); color: var(--success); padding: 8px 15px; border-radius: 20px; font-size: 13px; font-weight: bold; border: 1px solid var(--success);">
                🟢 أسعار السوق محدثة
            </div>
        `;
    }
};

// تكرار استدعاء الخوارزمية كل ساعة زمنية (3600000 مللي ثانية)
setInterval(window.syncWithLocalMarket, 3600000);

/**
 * 💡 [خوارزمية / برومبت تشغيل الكاميرا وقراءة الباركود]:
 * - الوظيفة: تفعيل الكاميرا الخلفية للهاتف لالتقاط ومسح الباركود الخاص بالمنتجات (Scanner).
 * - الآلية: استخدام مكتبة (Html5Qrcode)، وعند نجاح القراءة يتم وضع الكود في الـ Input المناسب وتشغيل حدث الـ keyup للبحث التلقائي.
 */
let html5QrCode = null;
let currentTargetInput = null;

window.startScanner = (inputId) => {
    currentTargetInput = inputId;
    window.openModal('scanner-modal');
    
    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }
    
    html5QrCode.start(
        { facingMode: "environment" }, // تشغيل الكاميرا الخلفية
        {
            fps: 10,
            qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
            // عند نجاح القراءة
            const inputField = document.getElementById(currentTargetInput);
            inputField.value = decodedText;
            
            // تحفيز الأحداث المرتبطة بالحقل لتفعيل استدعاء البيانات
            inputField.dispatchEvent(new Event('input'));
            inputField.dispatchEvent(new Event('keyup'));

            window.stopScanner();
            window.showToast("تم قراءة الباركود بنجاح!", "success");
        },
        (errorMessage) => {
            // يتم تجاهل أخطاء القراءة المستمرة حتى يتم التقاط الباركود الصحيح
        }
    ).catch((err) => {
        window.showToast("خطأ في تشغيل الكاميرا. تأكد من إعطاء الصلاحيات.", "error");
        console.error(err);
    });
};

window.stopScanner = () => {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            window.closeModal('scanner-modal');
        }).catch(err => {
            console.error("فشل في إيقاف الكاميرا", err);
            window.closeModal('scanner-modal');
        });
    } else {
        window.closeModal('scanner-modal');
    }
};

/**
 * 💡 [خوارزمية / برومبت معاينة الصور]:
 * - الوظيفة: قراءة الصورة التي يتم رفعها أو تصويرها محلياً وعرضها في مربع صغير قبل الحفظ.
 * - الآلية: تعتمد على الـ FileReader لتحويل الصورة لصيغة DataURL وعرضها.
 */
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

/**
 * 💡 [خوارزمية / برومبت التنقل والواجهة (UI Router)]:
 * - الوظيفة: التحكم في فتح وإغلاق النوافذ الجانبية والنوافذ المنبثقة (Modals) والتنقل بين أقسام النظام (Tabs).
 * - الآلية: إضافة أو إزالة الكلاس "hidden" للعنصر المراد إخفاؤه أو إظهاره.
 */
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
                document.getElementById('disp-code').focus();
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
 * 💡 [خوارزمية / برومبت التسجيل والمصادقة والأمان]:
 * - الوظيفة: إنشاء مستخدمين جدد وتسجيل الدخول وتحديد الصلاحيات (Role-Based Access Control).
 * - الآلية: يتم استدعاء Auth الخاص بفايربيز لإنشاء الإيميلات، ثم حفظ دور المستخدم (مدير/أمين) في كوليكشن Users. 
 * عند الدخول يتم إخفاء أجزاء معينة (زي الجرد والطلبيات) لو المستخدم مجرد "أمين مخزن".
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

    try {
        await createUserWithEmailAndPassword(auth, `${username}@mastech.erp`, password);
        
        await setDoc(doc(db, "users", username), { 
            username: username, 
            role: role, 
            shift: shift || "أمين مخزن", 
            createdAt: serverTimestamp() 
        });
        
        window.showToast("تم حفظ البيانات بنجاح!", "success");
        window.closeModal(role === 'admin' ? 'register-admin-modal' : 'add-storekeeper-modal');
    } catch (e) { 
        window.showToast("خطأ أمني: " + e.message, "error"); 
    }
};

window.login = async () => {
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value.trim();
    
    if (!u || !p) {
        return window.showToast("أدخل بيانات الدخول", "error");
    }

    try {
        await signInWithEmailAndPassword(auth, `${u}@mastech.erp`, p);
        const qSnap = await getDocs(query(collection(db, "users"), where("username", "==", u)));
        
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
            
            setTimeout(window.syncWithLocalMarket, 2000);
        }
    } catch (e) { 
        window.showToast("اسم المستخدم أو كلمة المرور غير صحيحة", "error"); 
    }
};

window.logout = async () => { 
    await signOut(auth); 
    location.reload(); 
};

/**
 * 💡 [خوارزمية / برومبت الإجراءات السريعة]:
 * - الوظيفة: اختصارات سريعة للضغط على الصرف أو طلب التوريد.
 */
window.quickDispense = (code) => {
    document.getElementById('disp-code').value = code;
    window.fetchProductForDispense(); 
    window.openModal('dispense-modal');
};

window.quickFactoryOrder = (name) => {
    document.getElementById('po-product-name').value = name;
    window.openModal('factory-order-modal');
};

/**
 * 💡 [خوارزمية / برومبت نظام الباركود العشوائي والطباعة]:
 * - الوظيفة: إنتاج أرقام باركود عشوائية فريدة 12 رقم وتجهيز الواجهة للطباعة.
 * - الآلية: دالة (JsBarcode) تقوم برسم الباركود على عنصر SVG ليتم طباعته على الليبل.
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
    
    JsBarcode("#barcode-svg", code, {
        format: "CODE128",
        displayValue: true,
        height: 50,
        fontSize: 16,
        margin: 10
    });
    
    document.body.classList.add('printing-barcode');
    window.print();
    
    setTimeout(() => {
        document.body.classList.remove('printing-barcode');
    }, 1000);
};

/**
 * 💡 [خوارزمية / برومبت طلبات المصانع وإدارة التوريدات]:
 * - الوظيفة: إرسال طلب جديد للمصنع بناءً على قاعدة بيانات الموردين.
 * - الآلية: تأخذ البيانات، تبحث في (suppliersDB) عن أقرب مورد، وتحفظ الطلب بحالة (جاري التجهيز).
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
    
    try {
        await addDoc(collection(db, "factory_orders"), { 
            product: name, 
            qty: qty, 
            unit: unit, 
            address: address, 
            userPhone: userPhone, 
            factory: supplier ? supplier.factory : "بحث في السوق الحر", 
            contact: supplier ? supplier.contact : "سيتم المتابعة لاحقاً", 
            status: "جاري التجهيز ⏳", 
            timestamp: serverTimestamp(), 
            orderedBy: window.currentUser 
        });
        
        window.showToast("تم إرسال الطلب للمصنع بنجاح", "success"); 
        window.closeModal('factory-order-modal');
    } catch(e) { 
        window.showToast("حدث خطأ أثناء الطلب", "error"); 
    }
};

window.cancelFactoryOrder = async (orderId) => {
    if (confirm("هل أنت متأكد من رغبتك في إلغاء هذا الطلب وحذفه نهائياً؟")) {
        try {
            await deleteDoc(doc(db, "factory_orders", orderId));
            window.showToast("تم إلغاء الطلب بنجاح ❌", "success");
        } catch(e) {
            window.showToast("حدث خطأ أثناء محاولة الإلغاء", "error");
        }
    }
};

/**
 * 💡 [خوارزمية / برومبت العمليات اليومية (تسجيل الوارد والصرف)]:
 * - الوظيفة: استقبال البضاعة وإضافتها للرصيد (الوارد)، أو صرف البضاعة وخصمها من الرصيد.
 * - الآلية: دالة (increment) تقوم بزيادة أو نقصان الكمية. إذا كان الرصيد صفر يتم نقل المنتج لأرشيف النواقص آلياً وتصفير الواجهة بعد نجاح الصرف.
 */
window.addIncoming = async () => {
    const code = document.getElementById('inc-code').value.trim(); 
    const name = document.getElementById('inc-name').value.trim();
    const price = parseInt(document.getElementById('inc-price').value) || 0; 
    const qty = parseInt(document.getElementById('inc-qty').value);
    const expiry = document.getElementById('inc-expiry').value || "دائم";

    if (!code || !name || !qty || isNaN(qty)) {
        return window.showToast("أكمل بيانات المنتج بشكل صحيح!", "error");
    }

    try {
        await setDoc(doc(db, "products", code), { 
            code: code, 
            name: name, 
            price: price, 
            qty: increment(qty), 
            expiry: expiry 
        }, { merge: true });
        
        await addMovementLog(code, name, "وارد 📥", qty, price);
        
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
    } else {
        document.getElementById('disp-name').value = "المنتج غير مسجل";
    }
};

window.submitDispense = async () => {
    const code = document.getElementById('disp-code').value.trim(); 
    const qty = parseInt(document.getElementById('disp-qty').value);
    
    if (!code || !qty || isNaN(qty) || qty <= 0) {
        return window.showToast("حقول فارغة أو كمية غير صحيحة!", "error");
    }
    
    let product = window.products.find(p => p.code === code); 
    
    if (!product || product.qty < qty) {
        return window.showToast("رصيد المخزن غير كافي!", "error");
    }
    
    try {
        await updateDoc(doc(db, "products", product.id), { 
            qty: increment(-qty) 
        });
        
        await addMovementLog(code, product.name, "منصرف 📤", qty, product.price);
        
        // خوارزمية النواقص والأرشيف: يتم تحويله للناقص إذا نفذ
        if (product.qty - qty <= 0) {
            await setDoc(doc(db, "archive", code), { 
                ...product, 
                qty: 0, 
                status: "نفذت الكمية 🔴" 
            });
        }
        
        window.showToast("تم صرف الفاتورة بنجاح", "success"); 
        
        // تفريغ الحقول بعد النجاح
        document.getElementById('disp-code').value = '';
        document.getElementById('disp-name').value = '';
        document.getElementById('disp-customer').value = '';
        document.getElementById('disp-qty').value = '';
        
        window.closeModal('dispense-modal');
    } catch(e) { 
        window.showToast("خطأ أثناء الصرف", "error"); 
    }
};

/**
 * 💡 [خوارزمية / برومبت تسجيل المرتجعات وحفظ حركات الموظفين (Logs)]:
 * - الوظيفة: استلام المرتجعات، إضافة الرصيد، تسجيل سبب الارتجاع، وربطه باسم الموظف الذي قام بالعملية.
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
            await updateDoc(doc(db, "products", product.id), { 
                qty: increment(qty) 
            });
        } else {
            await setDoc(doc(db, "products", code), { 
                code: code, 
                name: pName, 
                price: 0, 
                qty: qty, 
                expiry: "مراجعة" 
            });
        }
        
        await addDoc(collection(db, "returns"), { 
            code: code, 
            name: pName, 
            customer: customer, 
            qty: qty, 
            reason: reason, 
            timestamp: serverTimestamp() 
        });
        
        await addMovementLog(code, pName, "مرتجع 🔙", qty, product ? product.price : 0);
        
        window.showToast("تم تسجيل المرتجع بنجاح.", "success"); 
        
        document.querySelectorAll('#returns input').forEach(i => {
            i.value = '';
        });
    } catch(e) { 
        window.showToast("خطأ أثناء الإرجاع", "error"); 
    }
};

async function addMovementLog(code, name, type, qty, price) {
    let identifier = window.userRole === 'admin' ? `${window.currentUser} (${window.userShift})` : `${window.currentUser} (أمين مخزن)`;
    
    await addDoc(collection(db, "movements"), { 
        date: todayDateStr, 
        time: new Date().toLocaleTimeString('ar-EG'), 
        code: code, 
        name: name, 
        type: type, 
        qty: qty, 
        price: price, 
        employee: identifier, 
        timestamp: serverTimestamp() 
    });
}

/**
 * 💡 [خوارزمية / برومبت محرك الفلترة (Search Filter)]:
 * - الوظيفة: فلترة وعرض الكروت التي تطابق نص البحث في الكتالوج فقط لإعطاء تجربة بحث سريعة جداً.
 */
window.filterCatalog = () => {
    let input = document.getElementById('catalog-search').value.toLowerCase();
    let cards = document.querySelectorAll('.product-card');
    
    cards.forEach(card => {
        let text = card.innerText.toLowerCase();
        if (text.includes(input)) {
            card.style.display = "flex";
        } else {
            card.style.display = "none";
        }
    });
};

/**
 * 💡 [خوارزمية / برومبت محرك التحديث اللحظي (Real-time Snapshots) وتحديث الواجهة]:
 * - الوظيفة: استماع لتغيرات الداتابيز وتحديث مصفوفات البيانات (Products, Movements, etc..) لحظياً، ثم إعادة رسم الواجهة (updateUI) وتحديث الأرقام والإحصائيات والجداول.
 */
onSnapshot(collection(db, "products"), (snapshot) => { 
    window.products = []; 
    snapshot.forEach(doc => {
        window.products.push({ id: doc.id, ...doc.data() });
    }); 
    updateUI(); 
});

onSnapshot(collection(db, "movements"), (snapshot) => { 
    window.dailyMovements = []; 
    snapshot.forEach(doc => { 
        let data = doc.data(); 
        if (data.date === todayDateStr) {
            window.dailyMovements.push({ id: doc.id, ...data }); 
        }
    }); 
    updateUI(); 
});

onSnapshot(collection(db, "returns"), (snapshot) => { 
    window.returnsList = []; 
    snapshot.forEach(doc => {
        window.returnsList.push({ id: doc.id, ...doc.data() });
    }); 
    updateUI(); 
});

onSnapshot(collection(db, "archive"), (snapshot) => { 
    window.shortageArchive = []; 
    snapshot.forEach(doc => {
        window.shortageArchive.push({ id: doc.id, ...doc.data() });
    }); 
    updateUI(); 
});

onSnapshot(collection(db, "factory_orders"), (snapshot) => { 
    window.factoryOrders = []; 
    snapshot.forEach(doc => {
        window.factoryOrders.push({ id: doc.id, ...doc.data() });
    }); 
    updateUI(); 
});

function updateUI() {
    // 1. تحديث الإحصائيات (الأرقام الكبيرة فوق)
    document.getElementById('stat-total-products').innerText = window.products.length;
    document.getElementById('stat-total-returns').innerText = window.returnsList.length;
    document.getElementById('stat-total-archive').innerText = window.shortageArchive.length;
    
    // 2. تحديث جدول متابعة الطلبيات
    const ordersTbody = document.getElementById('factory-orders-tbody'); 
    if (ordersTbody) {
        ordersTbody.innerHTML = '';
        window.factoryOrders.forEach(o => { 
            ordersTbody.innerHTML += `
                <tr>
                    <td>${o.product}</td>
                    <td><strong style="color:var(--primary);">${o.qty} ${o.unit}</strong></td>
                    <td>🏭 ${o.factory}</td>
                    <td style="font-size: 13px;">
                        📞 المصنع: ${o.contact}<br>
                        <span style="color:var(--muted-text)">📱 رقمك: ${o.userPhone || 'غير مسجل'}</span>
                    </td>
                    <td style="color:var(--warning); font-weight:bold;">${o.status}</td>
                    <td>
                        <button onclick="cancelFactoryOrder('${o.id}')" class="btn-danger" style="padding: 6px 10px; font-size: 12px; border-radius: 6px;">
                            إلغاء الطلب ❌
                        </button>
                    </td>
                </tr>
            `; 
        });
    }

    // 3. تحديث جدول جرد المنتجات
    const prodTbody = document.getElementById('products-tbody'); 
    if (prodTbody) {
        prodTbody.innerHTML = '';
        window.products.forEach(p => { 
            prodTbody.innerHTML += `
                <tr>
                    <td>${p.code}</td>
                    <td>${p.name}</td>
                    <td><strong style="color:${p.qty > 0 ? 'var(--success)' : 'var(--danger)'}">${p.qty}</strong></td>
                    <td>${p.price} ج.م</td>
                    <td>${p.expiry || 'دائم'}</td>
                    <td>
                        <button onclick="printProductBarcode('${p.code}', '${p.name}', '${p.price}')" class="btn-secondary" style="padding: 5px 10px; font-size: 12px;">
                            🖨️ باركود
                        </button>
                    </td>
                </tr>
            `; 
        });
    }

    // 4. تحديث جدول الحركات اليومية
    const movTbody = document.getElementById('movement-tbody'); 
    if (movTbody) {
        movTbody.innerHTML = '';
        [...window.dailyMovements].sort((a,b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)).forEach(m => { 
            movTbody.innerHTML += `
                <tr>
                    <td>${m.time}</td>
                    <td>${m.type}</td>
                    <td>${m.name} (${m.code})</td>
                    <td>${m.qty}</td>
                    <td>${m.employee}</td>
                </tr>
            `; 
        });
    }

    // 5. تحديث جدول المرتجعات
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

    // 6. تحديث جدول الأرشيف والنواقص
    const archTbody = document.getElementById('archive-tbody'); 
    if (archTbody) {
        archTbody.innerHTML = '';
        window.shortageArchive.forEach(a => { 
            archTbody.innerHTML += `
                <tr>
                    <td>${a.code}</td>
                    <td>${a.name}</td>
                    <td style="color:var(--danger)">${a.status}</td>
                    <td>
                        <button onclick="openFactoryOrderModal('${a.name}')" class="btn-primary" style="padding: 6px 12px; font-size: 12px;">
                            طلب سريع من المصنع
                        </button>
                    </td>
                </tr>
            `; 
        });
    }
}

// ==========================================
// 🖨️ الطباعة العادية للتقارير
// ==========================================
window.preparePrint = () => { 
    window.print(); 
};
