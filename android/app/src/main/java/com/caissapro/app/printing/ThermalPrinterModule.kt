package com.caissapro.app.printing

import android.Manifest
import android.app.PendingIntent
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.hardware.usb.*
import android.os.Build
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.IOException
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.util.*
import java.util.concurrent.Executors
import kotlin.concurrent.thread

class ThermalPrinterModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "ThermalPrinterModule"
        const val TAG = "ThermalPrinter"
        
        // ESC/POS Commands
        const val ESC: Byte = 0x1B
        const val GS: Byte = 0x1D
        const val LF: Byte = 0x0A
        
        // Standard SPP UUID for Bluetooth printers
        val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
        
        // USB Action for permission
        const val ACTION_USB_PERMISSION = "com.caissapro.app.USB_PERMISSION"
        
        // Default WiFi port for thermal printers
        const val DEFAULT_WIFI_PORT = 9100
        
        // Connection timeout
        const val CONNECT_TIMEOUT_MS = 10000
        const val WRITE_TIMEOUT_MS = 5000
    }

    private val executor = Executors.newSingleThreadExecutor()
    
    // USB
    private var usbManager: UsbManager? = null
    private var usbConnection: UsbDeviceConnection? = null
    private var usbEndpoint: UsbEndpoint? = null
    private var usbInterface: UsbInterface? = null
    private var pendingUsbDevice: UsbDevice? = null
    private var usbPermissionPromise: Promise? = null
    
    // Bluetooth
    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bluetoothSocket: BluetoothSocket? = null
    private var bluetoothOutputStream: OutputStream? = null
    private var isDiscovering = false
    
    // WiFi
    private var wifiSocket: Socket? = null
    private var wifiOutputStream: OutputStream? = null
    
    // Current connection state
    private var currentTransport: String? = null
    private var isConnected = false

    // USB Permission Receiver
    private val usbPermissionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (ACTION_USB_PERMISSION == intent.action) {
                synchronized(this) {
                    val device = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
                    } else {
                        @Suppress("DEPRECATION")
                        intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
                    }
                    
                    if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                        device?.let {
                            Log.d(TAG, "USB permission granted for: ${it.deviceName}")
                            usbPermissionPromise?.resolve(true)
                        }
                    } else {
                        Log.e(TAG, "USB permission denied")
                        usbPermissionPromise?.reject("USB_PERMISSION_DENIED", "USB permission denied by user")
                    }
                    usbPermissionPromise = null
                    pendingUsbDevice = null
                }
            }
        }
    }

    // Bluetooth Discovery Receiver
    private val bluetoothDiscoveryReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            when (intent.action) {
                BluetoothDevice.ACTION_FOUND -> {
                    val device = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
                    } else {
                        @Suppress("DEPRECATION")
                        intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
                    }
                    device?.let {
                        sendDeviceFoundEvent(it)
                    }
                }
                BluetoothAdapter.ACTION_DISCOVERY_FINISHED -> {
                    isDiscovering = false
                    sendEvent("onDiscoveryFinished", null)
                }
            }
        }
    }

    init {
        usbManager = reactContext.getSystemService(Context.USB_SERVICE) as? UsbManager
        
        val bluetoothManager = reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        bluetoothAdapter = bluetoothManager?.adapter
        
        // Register USB permission receiver
        val usbFilter = IntentFilter(ACTION_USB_PERMISSION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(usbPermissionReceiver, usbFilter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            reactContext.registerReceiver(usbPermissionReceiver, usbFilter)
        }
        
        // Register Bluetooth discovery receiver
        val btFilter = IntentFilter().apply {
            addAction(BluetoothDevice.ACTION_FOUND)
            addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(bluetoothDiscoveryReceiver, btFilter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            reactContext.registerReceiver(bluetoothDiscoveryReceiver, btFilter)
        }
        
        Log.d(TAG, "ThermalPrinterModule initialized")
    }

    override fun getName(): String = NAME

    override fun getConstants(): MutableMap<String, Any> {
        return mutableMapOf(
            "TRANSPORT_USB" to "usb",
            "TRANSPORT_BLUETOOTH" to "bluetooth",
            "TRANSPORT_WIFI" to "wifi"
        )
    }

    // ============================================================================
    // PERMISSIONS
    // ============================================================================

    @ReactMethod
    fun checkBluetoothPermissions(promise: Promise) {
        try {
            val context = reactApplicationContext
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val connectGranted = ContextCompat.checkSelfPermission(
                    context, Manifest.permission.BLUETOOTH_CONNECT
                ) == PackageManager.PERMISSION_GRANTED
                
                val scanGranted = ContextCompat.checkSelfPermission(
                    context, Manifest.permission.BLUETOOTH_SCAN
                ) == PackageManager.PERMISSION_GRANTED
                
                promise.resolve(connectGranted && scanGranted)
            } else {
                val fineLocation = ContextCompat.checkSelfPermission(
                    context, Manifest.permission.ACCESS_FINE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
                
                promise.resolve(fineLocation)
            }
        } catch (e: Exception) {
            promise.reject("PERMISSION_ERROR", e.message)
        }
    }

    @ReactMethod
    fun isBluetoothEnabled(promise: Promise) {
        try {
            val enabled = bluetoothAdapter?.isEnabled == true
            promise.resolve(enabled)
        } catch (e: Exception) {
            promise.reject("BT_ERROR", e.message)
        }
    }

    // ============================================================================
    // USB FUNCTIONS
    // ============================================================================

    @ReactMethod
    fun getUsbDevices(promise: Promise) {
        try {
            val devices = usbManager?.deviceList ?: emptyMap()
            val result = Arguments.createArray()
            
            for ((_, device) in devices) {
                // Filter for printer class (0x07) or vendor-specific
                val isPrinter = (0 until device.interfaceCount).any { i ->
                    val iface = device.getInterface(i)
                    iface.interfaceClass == UsbConstants.USB_CLASS_PRINTER ||
                    iface.interfaceClass == UsbConstants.USB_CLASS_VENDOR_SPEC
                }
                
                if (isPrinter || device.vendorId != 0) {
                    val deviceMap = Arguments.createMap().apply {
                        putString("deviceId", device.deviceId.toString())
                        putString("deviceName", device.deviceName)
                        putInt("vendorId", device.vendorId)
                        putInt("productId", device.productId)
                        putString("productName", device.productName ?: "Unknown")
                        putString("manufacturerName", device.manufacturerName ?: "Unknown")
                        putBoolean("hasPermission", usbManager?.hasPermission(device) == true)
                    }
                    result.pushMap(deviceMap)
                }
            }
            
            Log.d(TAG, "Found ${result.size()} USB devices")
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting USB devices", e)
            promise.reject("USB_ERROR", e.message)
        }
    }

    @ReactMethod
    fun requestUsbPermission(deviceId: String, promise: Promise) {
        try {
            val device = usbManager?.deviceList?.values?.find { 
                it.deviceId.toString() == deviceId 
            }
            
            if (device == null) {
                promise.reject("USB_NOT_FOUND", "USB device not found")
                return
            }
            
            if (usbManager?.hasPermission(device) == true) {
                promise.resolve(true)
                return
            }
            
            pendingUsbDevice = device
            usbPermissionPromise = promise
            
            val permissionIntent = PendingIntent.getBroadcast(
                reactApplicationContext,
                0,
                Intent(ACTION_USB_PERMISSION),
                PendingIntent.FLAG_MUTABLE
            )
            
            usbManager?.requestPermission(device, permissionIntent)
            Log.d(TAG, "Requested USB permission for: ${device.deviceName}")
        } catch (e: Exception) {
            Log.e(TAG, "Error requesting USB permission", e)
            promise.reject("USB_PERMISSION_ERROR", e.message)
        }
    }

    @ReactMethod
    fun connectUsb(deviceId: String, promise: Promise) {
        executor.execute {
            try {
                // Disconnect existing
                disconnectUsbInternal()
                
                val device = usbManager?.deviceList?.values?.find { 
                    it.deviceId.toString() == deviceId 
                }
                
                if (device == null) {
                    promise.reject("USB_NOT_FOUND", "USB device not found")
                    return@execute
                }
                
                if (usbManager?.hasPermission(device) != true) {
                    promise.reject("USB_NO_PERMISSION", "No USB permission")
                    return@execute
                }
                
                // Find printer interface and endpoint
                var printerInterface: UsbInterface? = null
                var bulkOutEndpoint: UsbEndpoint? = null
                
                for (i in 0 until device.interfaceCount) {
                    val iface = device.getInterface(i)
                    for (j in 0 until iface.endpointCount) {
                        val endpoint = iface.getEndpoint(j)
                        if (endpoint.type == UsbConstants.USB_ENDPOINT_XFER_BULK &&
                            endpoint.direction == UsbConstants.USB_DIR_OUT) {
                            printerInterface = iface
                            bulkOutEndpoint = endpoint
                            break
                        }
                    }
                    if (bulkOutEndpoint != null) break
                }
                
                if (printerInterface == null || bulkOutEndpoint == null) {
                    promise.reject("USB_NO_ENDPOINT", "No suitable USB endpoint found")
                    return@execute
                }
                
                val connection = usbManager?.openDevice(device)
                if (connection == null) {
                    promise.reject("USB_OPEN_FAILED", "Failed to open USB device")
                    return@execute
                }
                
                if (!connection.claimInterface(printerInterface, true)) {
                    connection.close()
                    promise.reject("USB_CLAIM_FAILED", "Failed to claim USB interface")
                    return@execute
                }
                
                usbConnection = connection
                usbInterface = printerInterface
                usbEndpoint = bulkOutEndpoint
                currentTransport = "usb"
                isConnected = true
                
                Log.d(TAG, "USB connected: ${device.deviceName}")
                promise.resolve(true)
                
            } catch (e: Exception) {
                Log.e(TAG, "USB connect error", e)
                promise.reject("USB_CONNECT_ERROR", e.message)
            }
        }
    }

    private fun disconnectUsbInternal() {
        try {
            usbInterface?.let { usbConnection?.releaseInterface(it) }
            usbConnection?.close()
        } catch (e: Exception) {
            Log.e(TAG, "USB disconnect error", e)
        } finally {
            usbConnection = null
            usbInterface = null
            usbEndpoint = null
            if (currentTransport == "usb") {
                currentTransport = null
                isConnected = false
            }
        }
    }

    // ============================================================================
    // BLUETOOTH FUNCTIONS
    // ============================================================================

    @ReactMethod
    fun getPairedBluetoothDevices(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (ContextCompat.checkSelfPermission(
                    reactApplicationContext, 
                    Manifest.permission.BLUETOOTH_CONNECT
                ) != PackageManager.PERMISSION_GRANTED) {
                    promise.reject("BT_NO_PERMISSION", "Bluetooth permission not granted")
                    return
                }
            }
            
            val pairedDevices = bluetoothAdapter?.bondedDevices ?: emptySet()
            val result = Arguments.createArray()
            
            for (device in pairedDevices) {
                val deviceMap = Arguments.createMap().apply {
                    putString("address", device.address)
                    putString("name", device.name ?: "Unknown")
                    putInt("type", device.type)
                    putInt("bondState", device.bondState)
                    // Check if likely a printer by name
                    val isPrinter = device.name?.lowercase()?.let {
                        it.contains("printer") || it.contains("pos") || 
                        it.contains("thermal") || it.contains("receipt") ||
                        it.contains("58") || it.contains("80")
                    } ?: false
                    putBoolean("isProbablyPrinter", isPrinter)
                }
                result.pushMap(deviceMap)
            }
            
            Log.d(TAG, "Found ${result.size()} paired Bluetooth devices")
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting paired devices", e)
            promise.reject("BT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun startBluetoothDiscovery(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (ContextCompat.checkSelfPermission(
                    reactApplicationContext, 
                    Manifest.permission.BLUETOOTH_SCAN
                ) != PackageManager.PERMISSION_GRANTED) {
                    promise.reject("BT_NO_PERMISSION", "Bluetooth scan permission not granted")
                    return
                }
            }
            
            if (isDiscovering) {
                bluetoothAdapter?.cancelDiscovery()
            }
            
            isDiscovering = bluetoothAdapter?.startDiscovery() == true
            Log.d(TAG, "Bluetooth discovery started: $isDiscovering")
            promise.resolve(isDiscovering)
        } catch (e: Exception) {
            Log.e(TAG, "Error starting discovery", e)
            promise.reject("BT_DISCOVERY_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopBluetoothDiscovery(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (ContextCompat.checkSelfPermission(
                    reactApplicationContext, 
                    Manifest.permission.BLUETOOTH_SCAN
                ) != PackageManager.PERMISSION_GRANTED) {
                    promise.reject("BT_NO_PERMISSION", "Bluetooth scan permission not granted")
                    return
                }
            }
            
            bluetoothAdapter?.cancelDiscovery()
            isDiscovering = false
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("BT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun connectBluetooth(address: String, promise: Promise) {
        executor.execute {
            try {
                disconnectBluetoothInternal()
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    if (ContextCompat.checkSelfPermission(
                        reactApplicationContext, 
                        Manifest.permission.BLUETOOTH_CONNECT
                    ) != PackageManager.PERMISSION_GRANTED) {
                        promise.reject("BT_NO_PERMISSION", "Bluetooth connect permission not granted")
                        return@execute
                    }
                }
                
                // Cancel discovery before connecting
                bluetoothAdapter?.cancelDiscovery()
                
                val device = bluetoothAdapter?.getRemoteDevice(address)
                if (device == null) {
                    promise.reject("BT_NOT_FOUND", "Bluetooth device not found")
                    return@execute
                }
                
                Log.d(TAG, "Connecting to Bluetooth: ${device.name} ($address)")
                
                val socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                socket.connect()
                
                bluetoothSocket = socket
                bluetoothOutputStream = socket.outputStream
                currentTransport = "bluetooth"
                isConnected = true
                
                Log.d(TAG, "Bluetooth connected: ${device.name}")
                promise.resolve(true)
                
            } catch (e: IOException) {
                Log.e(TAG, "Bluetooth connect error", e)
                disconnectBluetoothInternal()
                promise.reject("BT_CONNECT_ERROR", "Connection failed: ${e.message}")
            } catch (e: Exception) {
                Log.e(TAG, "Bluetooth error", e)
                disconnectBluetoothInternal()
                promise.reject("BT_ERROR", e.message)
            }
        }
    }

    private fun disconnectBluetoothInternal() {
        try {
            bluetoothOutputStream?.close()
            bluetoothSocket?.close()
        } catch (e: Exception) {
            Log.e(TAG, "Bluetooth disconnect error", e)
        } finally {
            bluetoothOutputStream = null
            bluetoothSocket = null
            if (currentTransport == "bluetooth") {
                currentTransport = null
                isConnected = false
            }
        }
    }

    // ============================================================================
    // WIFI FUNCTIONS
    // ============================================================================

    @ReactMethod
    fun connectWifi(ipAddress: String, port: Int, promise: Promise) {
        executor.execute {
            try {
                disconnectWifiInternal()
                
                val actualPort = if (port > 0) port else DEFAULT_WIFI_PORT
                
                Log.d(TAG, "Connecting to WiFi printer: $ipAddress:$actualPort")
                
                val socket = Socket()
                socket.connect(InetSocketAddress(ipAddress, actualPort), CONNECT_TIMEOUT_MS)
                socket.soTimeout = WRITE_TIMEOUT_MS
                
                wifiSocket = socket
                wifiOutputStream = socket.getOutputStream()
                currentTransport = "wifi"
                isConnected = true
                
                Log.d(TAG, "WiFi connected: $ipAddress:$actualPort")
                promise.resolve(true)
                
            } catch (e: Exception) {
                Log.e(TAG, "WiFi connect error", e)
                disconnectWifiInternal()
                promise.reject("WIFI_CONNECT_ERROR", "Connection failed: ${e.message}")
            }
        }
    }

    private fun disconnectWifiInternal() {
        try {
            wifiOutputStream?.close()
            wifiSocket?.close()
        } catch (e: Exception) {
            Log.e(TAG, "WiFi disconnect error", e)
        } finally {
            wifiOutputStream = null
            wifiSocket = null
            if (currentTransport == "wifi") {
                currentTransport = null
                isConnected = false
            }
        }
    }

    // ============================================================================
    // PRINTING FUNCTIONS
    // ============================================================================

    @ReactMethod
    fun printRaw(data: ReadableArray, promise: Promise) {
        executor.execute {
            try {
                if (!isConnected) {
                    promise.reject("NOT_CONNECTED", "No printer connected")
                    return@execute
                }
                
                val bytes = ByteArray(data.size())
                for (i in 0 until data.size()) {
                    bytes[i] = data.getInt(i).toByte()
                }
                
                val bytesWritten = writeBytes(bytes)
                Log.d(TAG, "Printed $bytesWritten bytes via $currentTransport")
                promise.resolve(bytesWritten)
                
            } catch (e: Exception) {
                Log.e(TAG, "Print error", e)
                promise.reject("PRINT_ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun printText(text: String, promise: Promise) {
        executor.execute {
            try {
                if (!isConnected) {
                    promise.reject("NOT_CONNECTED", "No printer connected")
                    return@execute
                }
                
                // ESC/POS: Initialize + Text + Line Feed
                val initCmd = byteArrayOf(ESC, '@'.code.toByte())  // ESC @
                val textBytes = text.toByteArray(Charsets.UTF_8)
                val lfBytes = byteArrayOf(LF)
                
                val data = initCmd + textBytes + lfBytes
                val bytesWritten = writeBytes(data)
                
                Log.d(TAG, "Printed text ($bytesWritten bytes) via $currentTransport")
                promise.resolve(bytesWritten)
                
            } catch (e: Exception) {
                Log.e(TAG, "Print text error", e)
                promise.reject("PRINT_ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun printReceipt(receiptData: ReadableMap, promise: Promise) {
        executor.execute {
            try {
                if (!isConnected) {
                    promise.reject("NOT_CONNECTED", "No printer connected")
                    return@execute
                }
                
                val commands = buildReceiptCommands(receiptData)
                val bytesWritten = writeBytes(commands)
                
                Log.d(TAG, "Printed receipt ($bytesWritten bytes) via $currentTransport")
                promise.resolve(bytesWritten)
                
            } catch (e: Exception) {
                Log.e(TAG, "Print receipt error", e)
                promise.reject("PRINT_ERROR", e.message)
            }
        }
    }

    /**
     * Build ESC/POS receipt commands with proper formatting
     * Fixed layout order: Header -> Date -> Items -> Totals -> Payment -> Footer
     * No duplicate lines, clean monospaced alignment
     */
    private fun buildReceiptCommands(data: ReadableMap): ByteArray {
        val buffer = mutableListOf<Byte>()
        
        // Get formatting options
        val lineWidth = if (data.hasKey("lineWidth")) data.getInt("lineWidth") else 32
        val showOrderNumber = !data.hasKey("showOrderNumber") || data.getBoolean("showOrderNumber")
        val showTableNumber = !data.hasKey("showTableNumber") || data.getBoolean("showTableNumber")
        val showWaiterName = !data.hasKey("showWaiterName") || data.getBoolean("showWaiterName")
        val showDateTime = !data.hasKey("showDateTime") || data.getBoolean("showDateTime")
        val showPaymentDetails = !data.hasKey("showPaymentDetails") || data.getBoolean("showPaymentDetails")
        val showSubtotal = !data.hasKey("showSubtotal") || data.getBoolean("showSubtotal")
        val showTotal = !data.hasKey("showTotal") || data.getBoolean("showTotal")
        val showFooter = !data.hasKey("showFooter") || data.getBoolean("showFooter")
        val boldTotal = !data.hasKey("boldTotal") || data.getBoolean("boldTotal")
        val centerHeader = !data.hasKey("centerHeader") || data.getBoolean("centerHeader")
        val autoCut = !data.hasKey("autoCut") || data.getBoolean("autoCut")
        val separatorStyle = if (data.hasKey("separatorStyle")) data.getString("separatorStyle") else "dash"
        
        // Build separator based on style
        val sepChar = when (separatorStyle) {
            "equal" -> '='
            "dot" -> '.'
            else -> '-'
        }
        val separator = sepChar.toString().repeat(lineWidth)
        
        // ========== INITIALIZE PRINTER ==========
        buffer.addAll(byteArrayOf(ESC, '@'.code.toByte()).toList())
        
        // Set code page for French characters (Western Europe / Latin-1)
        buffer.addAll(byteArrayOf(ESC, 't'.code.toByte(), 6).toList())
        
        // ========== HEADER ==========
        if (centerHeader) {
            buffer.addAll(byteArrayOf(ESC, 'a'.code.toByte(), 1).toList())  // Center
        }
        buffer.addAll(byteArrayOf(GS, '!'.code.toByte(), 0x11).toList())  // Double width+height
        
        val header = data.getString("header") ?: "CaissaPro"
        buffer.addAll(header.toByteArray(Charsets.UTF_8).toList())
        buffer.add(LF)
        
        // Normal size for subheader
        buffer.addAll(byteArrayOf(GS, '!'.code.toByte(), 0).toList())
        
        // Address/subheader
        data.getString("subheader")?.takeIf { it.isNotBlank() }?.let { subheader ->
            buffer.addAll(subheader.toByteArray(Charsets.UTF_8).toList())
            buffer.add(LF)
        }
        
        // Phone
        data.getString("phone")?.takeIf { it.isNotBlank() }?.let { phone ->
            buffer.addAll("Tel: $phone".toByteArray(Charsets.UTF_8).toList())
            buffer.add(LF)
        }
        
        buffer.add(LF)
        
        // ========== ORDER INFO ==========
        buffer.addAll(byteArrayOf(ESC, 'a'.code.toByte(), 0).toList())  // Left align
        buffer.addAll(separator.toByteArray(Charsets.UTF_8).toList())
        buffer.add(LF)
        
        // Order number
        if (showOrderNumber) {
            val orderNumber = data.getString("orderNumber") ?: ""
            val orderLine = padLine("Commande:", "#$orderNumber", lineWidth)
            buffer.addAll(orderLine.toByteArray(Charsets.UTF_8).toList())
            buffer.add(LF)
        }
        
        // Date/Time
        if (showDateTime) {
            data.getString("date")?.let { date ->
                val dateLine = padLine("Date:", date, lineWidth)
                buffer.addAll(dateLine.toByteArray(Charsets.UTF_8).toList())
                buffer.add(LF)
            }
        }
        
        // Table number
        if (showTableNumber) {
            val tableNumber = if (data.hasKey("tableNumber")) data.getInt("tableNumber") else 0
            if (tableNumber > 0) {
                val tableLine = padLine("Table:", tableNumber.toString(), lineWidth)
                buffer.addAll(tableLine.toByteArray(Charsets.UTF_8).toList())
                buffer.add(LF)
            }
        }
        
        // Waiter name
        if (showWaiterName) {
            data.getString("waiterName")?.takeIf { it.isNotBlank() }?.let { waiter ->
                val waiterLine = padLine("Serveur:", waiter, lineWidth)
                buffer.addAll(waiterLine.toByteArray(Charsets.UTF_8).toList())
                buffer.add(LF)
            }
        }
        
        buffer.addAll(separator.toByteArray(Charsets.UTF_8).toList())
        buffer.add(LF)
        
        // ========== ITEMS ==========
        data.getArray("items")?.let { items ->
            for (i in 0 until items.size()) {
                items.getMap(i)?.let { item ->
                    val name = item.getString("name") ?: ""
                    val qty = item.getInt("quantity")
                    val total = item.getDouble("total")
                    
                    // Format: Name truncated, then "Qty x Total" right-aligned
                    // Example: "Cappuccino          1 x 15 DH"
                    val qtyPrice = String.format("%d x %.0f", qty, total)
                    val maxNameLen = lineWidth - qtyPrice.length - 4  // Leave space for " DH"
                    val truncatedName = name.take(maxNameLen)
                    
                    val itemLine = padLine(truncatedName, "$qtyPrice DH", lineWidth)
                    buffer.addAll(itemLine.toByteArray(Charsets.UTF_8).toList())
                    buffer.add(LF)
                }
            }
        }
        
        buffer.addAll(separator.toByteArray(Charsets.UTF_8).toList())
        buffer.add(LF)
        
        // ========== TOTALS ==========
        // Subtotal
        if (showSubtotal) {
            val subtotal = if (data.hasKey("subtotal")) data.getDouble("subtotal") else 0.0
            val subtotalLine = padLine("Sous-total:", String.format("%.2f DH", subtotal), lineWidth)
            buffer.addAll(subtotalLine.toByteArray(Charsets.UTF_8).toList())
            buffer.add(LF)
        }
        
        // Discount
        val discount = if (data.hasKey("discount")) data.getDouble("discount") else 0.0
        if (discount > 0) {
            val discountLine = padLine("Remise:", String.format("-%.2f DH", discount), lineWidth)
            buffer.addAll(discountLine.toByteArray(Charsets.UTF_8).toList())
            buffer.add(LF)
        }
        
        // TOTAL (bold and larger)
        if (showTotal) {
            if (boldTotal) {
                buffer.addAll(byteArrayOf(ESC, 'E'.code.toByte(), 1).toList())  // Bold ON
                buffer.addAll(byteArrayOf(GS, '!'.code.toByte(), 0x10).toList())  // Double width
            }
            
            val total = if (data.hasKey("total")) data.getDouble("total") else 0.0
            val totalLine = padLine("TOTAL:", String.format("%.2f DH", total), lineWidth)
            buffer.addAll(totalLine.toByteArray(Charsets.UTF_8).toList())
            buffer.add(LF)
            
            if (boldTotal) {
                buffer.addAll(byteArrayOf(ESC, 'E'.code.toByte(), 0).toList())  // Bold OFF
                buffer.addAll(byteArrayOf(GS, '!'.code.toByte(), 0).toList())  // Normal size
            }
        }
        
        // ========== PAYMENT DETAILS ==========
        if (showPaymentDetails) {
            buffer.addAll(separator.toByteArray(Charsets.UTF_8).toList())
            buffer.add(LF)
            
            // Payment method
            data.getString("paymentMethod")?.takeIf { it.isNotBlank() }?.let { method ->
                val paymentLine = padLine("Paiement:", method, lineWidth)
                buffer.addAll(paymentLine.toByteArray(Charsets.UTF_8).toList())
                buffer.add(LF)
            }
            
            // Amount received (for cash)
            val amountReceived = if (data.hasKey("amountReceived")) data.getDouble("amountReceived") else 0.0
            if (amountReceived > 0) {
                val receivedLine = padLine("Recu:", String.format("%.2f DH", amountReceived), lineWidth)
                buffer.addAll(receivedLine.toByteArray(Charsets.UTF_8).toList())
                buffer.add(LF)
            }
            
            // Change
            val change = if (data.hasKey("change")) data.getDouble("change") else 0.0
            if (change > 0) {
                val changeLine = padLine("Monnaie:", String.format("%.2f DH", change), lineWidth)
                buffer.addAll(changeLine.toByteArray(Charsets.UTF_8).toList())
                buffer.add(LF)
            }
        }
        
        // ========== FOOTER ==========
        if (showFooter) {
            buffer.add(LF)
            buffer.addAll(byteArrayOf(ESC, 'a'.code.toByte(), 1).toList())  // Center
            
            val footer = data.getString("footerMessage") ?: "Merci de votre visite!"
            buffer.addAll(footer.toByteArray(Charsets.UTF_8).toList())
            buffer.add(LF)
        }
        
        // ========== FEED AND CUT ==========
        buffer.addAll(byteArrayOf(ESC, 'd'.code.toByte(), 4).toList())  // Feed 4 lines
        
        if (autoCut) {
            buffer.addAll(byteArrayOf(GS, 'V'.code.toByte(), 1).toList())  // Partial cut
        }
        
        Log.d(TAG, "Receipt built: ${buffer.size} bytes, lineWidth=$lineWidth")
        return buffer.toByteArray()
    }
    
    /**
     * Pad a line with left text and right text, filling middle with spaces
     */
    private fun padLine(left: String, right: String, width: Int): String {
        val spaces = width - left.length - right.length
        return if (spaces > 0) {
            left + " ".repeat(spaces) + right
        } else {
            // Line too long, truncate left side
            val maxLeft = width - right.length - 1
            if (maxLeft > 0) {
                left.take(maxLeft) + " " + right
            } else {
                right.takeLast(width)
            }
        }
    }

    @ReactMethod
    fun printTestPage(promise: Promise) {
        executor.execute {
            try {
                if (!isConnected) {
                    promise.reject("NOT_CONNECTED", "No printer connected")
                    return@execute
                }
                
                val buffer = mutableListOf<Byte>()
                
                // Initialize
                buffer.addAll(byteArrayOf(ESC, '@'.code.toByte()).toList())
                
                // Center align
                buffer.addAll(byteArrayOf(ESC, 'a'.code.toByte(), 1).toList())
                
                // Double size
                buffer.addAll(byteArrayOf(GS, '!'.code.toByte(), 0x11).toList())
                buffer.addAll("TEST IMPRESSION\n".toByteArray(Charsets.UTF_8).toList())
                
                // Normal
                buffer.addAll(byteArrayOf(GS, '!'.code.toByte(), 0).toList())
                buffer.addAll("================================\n".toByteArray(Charsets.UTF_8).toList())
                
                // Left align
                buffer.addAll(byteArrayOf(ESC, 'a'.code.toByte(), 0).toList())
                
                val timestamp = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
                    .format(Date())
                buffer.addAll("Date: $timestamp\n".toByteArray(Charsets.UTF_8).toList())
                buffer.addAll("Transport: $currentTransport\n".toByteArray(Charsets.UTF_8).toList())
                buffer.addAll("================================\n".toByteArray(Charsets.UTF_8).toList())
                
                // Character test
                buffer.addAll("\nTest caracteres:\n".toByteArray(Charsets.UTF_8).toList())
                buffer.addAll("ABCDEFGHIJKLMNOPQRSTUVWXYZ\n".toByteArray(Charsets.UTF_8).toList())
                buffer.addAll("0123456789\n".toByteArray(Charsets.UTF_8).toList())
                buffer.addAll("!@#\$%^&*()_+-=\n".toByteArray(Charsets.UTF_8).toList())
                
                // French characters
                buffer.addAll("\nFrancais:\n".toByteArray(Charsets.UTF_8).toList())
                buffer.addAll("éèêëàâäùûüôöîïç\n".toByteArray(Charsets.UTF_8).toList())
                
                buffer.addAll("\n================================\n".toByteArray(Charsets.UTF_8).toList())
                
                // Center
                buffer.addAll(byteArrayOf(ESC, 'a'.code.toByte(), 1).toList())
                
                // Bold
                buffer.addAll(byteArrayOf(ESC, 'E'.code.toByte(), 1).toList())
                buffer.addAll("CaissaPro v2.1.0\n".toByteArray(Charsets.UTF_8).toList())
                buffer.addAll(byteArrayOf(ESC, 'E'.code.toByte(), 0).toList())
                
                buffer.addAll("Impression reussie!\n".toByteArray(Charsets.UTF_8).toList())
                
                // Feed and cut
                buffer.addAll(byteArrayOf(ESC, 'd'.code.toByte(), 4).toList())
                buffer.addAll(byteArrayOf(GS, 'V'.code.toByte(), 1).toList())
                
                val bytesWritten = writeBytes(buffer.toByteArray())
                Log.d(TAG, "Test page printed ($bytesWritten bytes)")
                promise.resolve(bytesWritten)
                
            } catch (e: Exception) {
                Log.e(TAG, "Test page error", e)
                promise.reject("PRINT_ERROR", e.message)
            }
        }
    }

    @ReactMethod
    fun openCashDrawer(promise: Promise) {
        executor.execute {
            try {
                if (!isConnected) {
                    promise.reject("NOT_CONNECTED", "No printer connected")
                    return@execute
                }
                
                // ESC p m t1 t2 - Open cash drawer
                val cmd = byteArrayOf(ESC, 'p'.code.toByte(), 0, 25, -6)
                val bytesWritten = writeBytes(cmd)
                
                Log.d(TAG, "Cash drawer command sent")
                promise.resolve(bytesWritten)
                
            } catch (e: Exception) {
                promise.reject("DRAWER_ERROR", e.message)
            }
        }
    }

    private fun writeBytes(data: ByteArray): Int {
        return when (currentTransport) {
            "usb" -> {
                val result = usbConnection?.bulkTransfer(
                    usbEndpoint, data, data.size, WRITE_TIMEOUT_MS
                ) ?: -1
                if (result < 0) throw IOException("USB write failed: $result")
                result
            }
            "bluetooth" -> {
                bluetoothOutputStream?.write(data)
                bluetoothOutputStream?.flush()
                data.size
            }
            "wifi" -> {
                wifiOutputStream?.write(data)
                wifiOutputStream?.flush()
                data.size
            }
            else -> throw IOException("No transport connected")
        }
    }

    // ============================================================================
    // CONNECTION STATUS
    // ============================================================================

    @ReactMethod
    fun getConnectionStatus(promise: Promise) {
        val result = Arguments.createMap().apply {
            putBoolean("isConnected", isConnected)
            putString("transport", currentTransport)
        }
        promise.resolve(result)
    }

    @ReactMethod
    fun disconnect(promise: Promise) {
        executor.execute {
            try {
                when (currentTransport) {
                    "usb" -> disconnectUsbInternal()
                    "bluetooth" -> disconnectBluetoothInternal()
                    "wifi" -> disconnectWifiInternal()
                }
                currentTransport = null
                isConnected = false
                Log.d(TAG, "Disconnected")
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("DISCONNECT_ERROR", e.message)
            }
        }
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    private fun sendDeviceFoundEvent(device: BluetoothDevice) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(
                reactApplicationContext, 
                Manifest.permission.BLUETOOTH_CONNECT
            ) != PackageManager.PERMISSION_GRANTED) {
                return
            }
        }
        
        val params = Arguments.createMap().apply {
            putString("address", device.address)
            putString("name", device.name ?: "Unknown")
            putInt("type", device.type)
        }
        sendEvent("onBluetoothDeviceFound", params)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN event emitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN event emitter
    }

    override fun invalidate() {
        super.invalidate()
        try {
            reactApplicationContext.unregisterReceiver(usbPermissionReceiver)
            reactApplicationContext.unregisterReceiver(bluetoothDiscoveryReceiver)
        } catch (e: Exception) {
            Log.e(TAG, "Error unregistering receivers", e)
        }
        disconnectUsbInternal()
        disconnectBluetoothInternal()
        disconnectWifiInternal()
        executor.shutdown()
    }
}
