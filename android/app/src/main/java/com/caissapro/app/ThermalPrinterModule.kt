package com.caissapro.app

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.IOException
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.nio.charset.Charset
import java.util.*
import kotlin.concurrent.thread

class ThermalPrinterModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

    companion object {
        private const val TAG = "ThermalPrinterModule"
        private const val MODULE_NAME = "ThermalPrinterModule"
        
        // Standard SPP UUID for Bluetooth serial
        private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
        
        // Connection states
        private const val STATE_DISCONNECTED = 0
        private const val STATE_CONNECTING = 1
        private const val STATE_CONNECTED = 2
        
        // Transport types
        const val TRANSPORT_USB = "usb"
        const val TRANSPORT_BLUETOOTH = "bluetooth"
        const val TRANSPORT_WIFI = "wifi"
    }

    // Bluetooth
    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bluetoothSocket: BluetoothSocket? = null
    private var btOutputStream: OutputStream? = null
    
    // WiFi
    private var wifiSocket: Socket? = null
    private var wifiOutputStream: OutputStream? = null
    
    // USB
    private var usbManager: UsbManager? = null
    
    // State
    private var connectionState = STATE_DISCONNECTED
    private var currentTransport: String? = null
    private var currentDeviceAddress: String? = null

    // Bluetooth discovery receiver
    private var discoveryReceiver: BroadcastReceiver? = null
    private var discoveredDevices = mutableListOf<BluetoothDevice>()

    init {
        reactContext.addLifecycleEventListener(this)
        
        // Initialize Bluetooth
        val bluetoothManager = reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        bluetoothAdapter = bluetoothManager?.adapter
        
        // Initialize USB
        usbManager = reactContext.getSystemService(Context.USB_SERVICE) as? UsbManager
    }

    override fun getName(): String = MODULE_NAME

    override fun getConstants(): MutableMap<String, Any> {
        return hashMapOf(
            "TRANSPORT_USB" to TRANSPORT_USB,
            "TRANSPORT_BLUETOOTH" to TRANSPORT_BLUETOOTH,
            "TRANSPORT_WIFI" to TRANSPORT_WIFI
        )
    }

    // ============================================================================
    // BLUETOOTH PERMISSIONS & STATUS
    // ============================================================================

    @ReactMethod
    fun checkBluetoothPermissions(promise: Promise) {
        try {
            val context = reactApplicationContext
            val hasPermissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == 
                    PackageManager.PERMISSION_GRANTED &&
                ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) == 
                    PackageManager.PERMISSION_GRANTED
            } else {
                ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == 
                    PackageManager.PERMISSION_GRANTED
            }
            promise.resolve(hasPermissions)
        } catch (e: Exception) {
            Log.e(TAG, "checkBluetoothPermissions error: ${e.message}")
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun isBluetoothEnabled(promise: Promise) {
        try {
            val enabled = bluetoothAdapter?.isEnabled ?: false
            promise.resolve(enabled)
        } catch (e: Exception) {
            Log.e(TAG, "isBluetoothEnabled error: ${e.message}")
            promise.resolve(false)
        }
    }

    // ============================================================================
    // BLUETOOTH DEVICE DISCOVERY
    // ============================================================================

    @SuppressLint("MissingPermission")
    @ReactMethod
    fun getPairedBluetoothDevices(promise: Promise) {
        try {
            if (bluetoothAdapter == null) {
                promise.reject("BT_NOT_AVAILABLE", "Bluetooth non disponible")
                return
            }

            if (!hasBluetoothPermissions()) {
                promise.reject("BT_NO_PERMISSION", "Permissions Bluetooth non accordées")
                return
            }

            val pairedDevices = bluetoothAdapter?.bondedDevices ?: emptySet()
            val deviceArray = Arguments.createArray()

            for (device in pairedDevices) {
                val deviceMap = Arguments.createMap().apply {
                    putString("address", device.address)
                    putString("name", device.name ?: "Appareil inconnu")
                    putInt("type", device.type)
                    putInt("bondState", device.bondState)
                    // Filter for likely printers (thermal printers often have these in their names)
                    val isPrinter = device.name?.let { name ->
                        val lowerName = name.lowercase()
                        lowerName.contains("printer") ||
                        lowerName.contains("thermal") ||
                        lowerName.contains("pos") ||
                        lowerName.contains("escpos") ||
                        lowerName.contains("58mm") ||
                        lowerName.contains("80mm") ||
                        lowerName.contains("zj") ||
                        lowerName.contains("xp") ||
                        lowerName.contains("pt-") ||
                        lowerName.contains("mp-") ||
                        lowerName.contains("t") // Many thermal printers have T in name
                    } ?: false
                    putBoolean("isProbablyPrinter", isPrinter)
                }
                deviceArray.pushMap(deviceMap)
            }

            promise.resolve(deviceArray)
        } catch (e: SecurityException) {
            Log.e(TAG, "getPairedBluetoothDevices security error: ${e.message}")
            promise.reject("BT_SECURITY_ERROR", "Permission Bluetooth refusée: ${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "getPairedBluetoothDevices error: ${e.message}")
            promise.reject("BT_ERROR", "Erreur: ${e.message}")
        }
    }

    @SuppressLint("MissingPermission")
    @ReactMethod
    fun startBluetoothDiscovery(promise: Promise) {
        try {
            if (bluetoothAdapter == null) {
                promise.reject("BT_NOT_AVAILABLE", "Bluetooth non disponible")
                return
            }

            if (!hasBluetoothPermissions()) {
                promise.reject("BT_NO_PERMISSION", "Permissions Bluetooth non accordées")
                return
            }

            discoveredDevices.clear()
            
            // Register for Bluetooth discovery events
            if (discoveryReceiver == null) {
                discoveryReceiver = object : BroadcastReceiver() {
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
                                    if (!discoveredDevices.any { d -> d.address == it.address }) {
                                        discoveredDevices.add(it)
                                        sendDeviceFoundEvent(it)
                                    }
                                }
                            }
                            BluetoothAdapter.ACTION_DISCOVERY_FINISHED -> {
                                sendEvent("EVENT_DISCOVERY_FINISHED", null)
                            }
                        }
                    }
                }

                val filter = IntentFilter().apply {
                    addAction(BluetoothDevice.ACTION_FOUND)
                    addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED)
                }
                reactApplicationContext.registerReceiver(discoveryReceiver, filter)
            }

            // Start discovery
            if (bluetoothAdapter?.isDiscovering == true) {
                bluetoothAdapter?.cancelDiscovery()
            }
            
            val started = bluetoothAdapter?.startDiscovery() ?: false
            promise.resolve(started)
        } catch (e: SecurityException) {
            Log.e(TAG, "startBluetoothDiscovery security error: ${e.message}")
            promise.reject("BT_SECURITY_ERROR", "Permission refusée: ${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "startBluetoothDiscovery error: ${e.message}")
            promise.reject("BT_ERROR", "Erreur: ${e.message}")
        }
    }

    @SuppressLint("MissingPermission")
    @ReactMethod
    fun stopBluetoothDiscovery(promise: Promise) {
        try {
            bluetoothAdapter?.cancelDiscovery()
            discoveryReceiver?.let {
                try {
                    reactApplicationContext.unregisterReceiver(it)
                } catch (e: Exception) {
                    // Ignore if not registered
                }
            }
            discoveryReceiver = null
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "stopBluetoothDiscovery error: ${e.message}")
            promise.resolve(true)
        }
    }

    // ============================================================================
    // BLUETOOTH CONNECTION
    // ============================================================================

    @SuppressLint("MissingPermission")
    @ReactMethod
    fun connectBluetooth(address: String, promise: Promise) {
        thread {
            try {
                if (bluetoothAdapter == null) {
                    promise.reject("BT_NOT_AVAILABLE", "Bluetooth non disponible")
                    return@thread
                }

                if (!hasBluetoothPermissions()) {
                    promise.reject("BT_NO_PERMISSION", "Permissions Bluetooth non accordées")
                    return@thread
                }

                // Disconnect existing connection first
                disconnectInternal()

                connectionState = STATE_CONNECTING
                sendEvent("EVENT_CONNECTING", null)

                // Cancel discovery before connecting
                if (bluetoothAdapter?.isDiscovering == true) {
                    bluetoothAdapter?.cancelDiscovery()
                }

                val device = bluetoothAdapter?.getRemoteDevice(address)
                if (device == null) {
                    connectionState = STATE_DISCONNECTED
                    promise.reject("BT_DEVICE_NOT_FOUND", "Appareil non trouvé: $address")
                    return@thread
                }

                // Try to create socket and connect
                bluetoothSocket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                
                try {
                    bluetoothSocket?.connect()
                } catch (e: IOException) {
                    // Fallback: try reflection method for older devices
                    Log.w(TAG, "Standard connection failed, trying fallback...")
                    try {
                        bluetoothSocket?.close()
                        val method = device.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType)
                        bluetoothSocket = method.invoke(device, 1) as BluetoothSocket
                        bluetoothSocket?.connect()
                    } catch (e2: Exception) {
                        Log.e(TAG, "Fallback connection also failed: ${e2.message}")
                        connectionState = STATE_DISCONNECTED
                        sendEvent("EVENT_UNABLE_CONNECT", null)
                        promise.reject("BT_CONNECT_FAILED", "Impossible de se connecter: ${e2.message}")
                        return@thread
                    }
                }

                btOutputStream = bluetoothSocket?.outputStream
                connectionState = STATE_CONNECTED
                currentTransport = TRANSPORT_BLUETOOTH
                currentDeviceAddress = address

                Log.i(TAG, "Connected to Bluetooth device: $address")
                sendEvent("EVENT_CONNECTED", Arguments.createMap().apply {
                    putString("address", address)
                    putString("name", device.name ?: "")
                    putString("transport", TRANSPORT_BLUETOOTH)
                })

                promise.resolve(true)
            } catch (e: SecurityException) {
                Log.e(TAG, "connectBluetooth security error: ${e.message}")
                connectionState = STATE_DISCONNECTED
                sendEvent("EVENT_UNABLE_CONNECT", null)
                promise.reject("BT_SECURITY_ERROR", "Permission refusée: ${e.message}")
            } catch (e: Exception) {
                Log.e(TAG, "connectBluetooth error: ${e.message}")
                connectionState = STATE_DISCONNECTED
                sendEvent("EVENT_UNABLE_CONNECT", null)
                promise.reject("BT_ERROR", "Erreur de connexion: ${e.message}")
            }
        }
    }

    // ============================================================================
    // WIFI CONNECTION
    // ============================================================================

    @ReactMethod
    fun connectWifi(ipAddress: String, port: Int, promise: Promise) {
        thread {
            try {
                disconnectInternal()

                connectionState = STATE_CONNECTING
                sendEvent("EVENT_CONNECTING", null)

                wifiSocket = Socket()
                wifiSocket?.connect(InetSocketAddress(ipAddress, port), 10000)
                wifiOutputStream = wifiSocket?.getOutputStream()

                connectionState = STATE_CONNECTED
                currentTransport = TRANSPORT_WIFI
                currentDeviceAddress = "$ipAddress:$port"

                Log.i(TAG, "Connected to WiFi printer: $ipAddress:$port")
                sendEvent("EVENT_CONNECTED", Arguments.createMap().apply {
                    putString("address", "$ipAddress:$port")
                    putString("transport", TRANSPORT_WIFI)
                })

                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "connectWifi error: ${e.message}")
                connectionState = STATE_DISCONNECTED
                sendEvent("EVENT_UNABLE_CONNECT", null)
                promise.reject("WIFI_ERROR", "Erreur de connexion WiFi: ${e.message}")
            }
        }
    }

    // ============================================================================
    // USB (Basic support)
    // ============================================================================

    @ReactMethod
    fun getUsbDevices(promise: Promise) {
        try {
            val devices = Arguments.createArray()
            usbManager?.deviceList?.values?.forEach { device ->
                devices.pushMap(Arguments.createMap().apply {
                    putString("deviceId", device.deviceId.toString())
                    putString("deviceName", device.deviceName)
                    putInt("vendorId", device.vendorId)
                    putInt("productId", device.productId)
                    putString("productName", device.productName ?: "")
                    putString("manufacturerName", device.manufacturerName ?: "")
                })
            }
            promise.resolve(devices)
        } catch (e: Exception) {
            Log.e(TAG, "getUsbDevices error: ${e.message}")
            promise.reject("USB_ERROR", "Erreur USB: ${e.message}")
        }
    }

    @ReactMethod
    fun connectUsb(deviceId: String, promise: Promise) {
        // USB printing requires more complex setup with USB permissions
        // For now, return not implemented
        promise.reject("USB_NOT_IMPLEMENTED", "Connexion USB non implémentée. Utilisez Bluetooth ou WiFi.")
    }

    // ============================================================================
    // CONNECTION STATUS
    // ============================================================================

    @ReactMethod
    fun getConnectionStatus(promise: Promise) {
        try {
            promise.resolve(Arguments.createMap().apply {
                putBoolean("isConnected", connectionState == STATE_CONNECTED)
                putBoolean("isConnecting", connectionState == STATE_CONNECTING)
                putString("transport", currentTransport ?: "")
                putString("address", currentDeviceAddress ?: "")
            })
        } catch (e: Exception) {
            promise.reject("ERROR", "Erreur: ${e.message}")
        }
    }

    @ReactMethod
    fun disconnect(promise: Promise) {
        try {
            disconnectInternal()
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "disconnect error: ${e.message}")
            promise.resolve(true)
        }
    }

    private fun disconnectInternal() {
        try {
            btOutputStream?.close()
            bluetoothSocket?.close()
            wifiOutputStream?.close()
            wifiSocket?.close()
        } catch (e: Exception) {
            Log.e(TAG, "disconnectInternal error: ${e.message}")
        } finally {
            btOutputStream = null
            bluetoothSocket = null
            wifiOutputStream = null
            wifiSocket = null
            connectionState = STATE_DISCONNECTED
            currentTransport = null
            currentDeviceAddress = null
            sendEvent("EVENT_DISCONNECTED", null)
        }
    }

    // ============================================================================
    // PRINTING
    // ============================================================================

    @ReactMethod
    fun printText(text: String, promise: Promise) {
        thread {
            try {
                if (connectionState != STATE_CONNECTED) {
                    promise.reject("NOT_CONNECTED", "Imprimante non connectée")
                    return@thread
                }

                val outputStream = getActiveOutputStream()
                if (outputStream == null) {
                    promise.reject("NO_OUTPUT", "Flux de sortie non disponible")
                    return@thread
                }

                // ESC/POS init + text + feed + cut
                val escInit = byteArrayOf(0x1B, 0x40) // ESC @
                val escFeed = byteArrayOf(0x0A, 0x0A, 0x0A) // 3 line feeds
                val escCut = byteArrayOf(0x1D, 0x56, 0x01) // GS V 1 (partial cut)

                outputStream.write(escInit)
                outputStream.write(text.toByteArray(Charsets.UTF_8))
                outputStream.write(escFeed)
                outputStream.write(escCut)
                outputStream.flush()

                Log.i(TAG, "Print text successful")
                promise.resolve(text.length)
            } catch (e: IOException) {
                Log.e(TAG, "printText IO error: ${e.message}")
                handleConnectionLost()
                promise.reject("PRINT_ERROR", "Erreur d'impression: ${e.message}")
            } catch (e: Exception) {
                Log.e(TAG, "printText error: ${e.message}")
                promise.reject("PRINT_ERROR", "Erreur d'impression: ${e.message}")
            }
        }
    }

    @ReactMethod
    fun printRaw(data: ReadableArray, promise: Promise) {
        thread {
            try {
                if (connectionState != STATE_CONNECTED) {
                    promise.reject("NOT_CONNECTED", "Imprimante non connectée")
                    return@thread
                }

                val outputStream = getActiveOutputStream()
                if (outputStream == null) {
                    promise.reject("NO_OUTPUT", "Flux de sortie non disponible")
                    return@thread
                }

                val bytes = ByteArray(data.size())
                for (i in 0 until data.size()) {
                    bytes[i] = data.getInt(i).toByte()
                }

                outputStream.write(bytes)
                outputStream.flush()

                Log.i(TAG, "Print raw successful: ${bytes.size} bytes")
                promise.resolve(bytes.size)
            } catch (e: IOException) {
                Log.e(TAG, "printRaw IO error: ${e.message}")
                handleConnectionLost()
                promise.reject("PRINT_ERROR", "Erreur d'impression: ${e.message}")
            } catch (e: Exception) {
                Log.e(TAG, "printRaw error: ${e.message}")
                promise.reject("PRINT_ERROR", "Erreur d'impression: ${e.message}")
            }
        }
    }

    /**
     * Print a formatted receipt using ESC/POS commands
     * This is the main receipt printing method used by PrinterService
     */
    @ReactMethod
    fun printReceipt(data: ReadableMap, promise: Promise) {
        thread {
            try {
                if (connectionState != STATE_CONNECTED) {
                    promise.reject("NOT_CONNECTED", "Imprimante non connectée")
                    return@thread
                }

                val outputStream = getActiveOutputStream()
                if (outputStream == null) {
                    promise.reject("NO_OUTPUT", "Flux de sortie non disponible")
                    return@thread
                }

                // Build receipt bytes
                val receiptBytes = buildReceiptBytes(data)
                
                outputStream.write(receiptBytes)
                outputStream.flush()

                Log.i(TAG, "Receipt printed successfully: ${receiptBytes.size} bytes")
                promise.resolve(receiptBytes.size)
            } catch (e: IOException) {
                Log.e(TAG, "printReceipt IO error: ${e.message}")
                handleConnectionLost()
                promise.reject("PRINT_ERROR", "Erreur d'impression: ${e.message}")
            } catch (e: Exception) {
                Log.e(TAG, "printReceipt error: ${e.message}")
                promise.reject("PRINT_ERROR", "Erreur d'impression: ${e.message}")
            }
        }
    }

    /**
     * Build ESC/POS byte array for receipt printing
     * Supports proper French character encoding (Windows-1252)
     */
    private fun buildReceiptBytes(data: ReadableMap): ByteArray {
        val buffer = mutableListOf<Byte>()
        
        // Get configuration
        val lineWidth = data.getInt("lineWidth").takeIf { it > 0 } ?: 48
        val separatorStyle = data.getString("separatorStyle") ?: "dash"
        val centerHeader = !data.hasKey("centerHeader") || data.getBoolean("centerHeader")
        val boldTotal = !data.hasKey("boldTotal") || data.getBoolean("boldTotal")
        val autoCut = !data.hasKey("autoCut") || data.getBoolean("autoCut")
        
        val separatorChar = when (separatorStyle) {
            "equal" -> '='
            "dot" -> '.'
            else -> '-'
        }
        
        // ESC/POS Commands
        fun addBytes(vararg bytes: Int) = bytes.forEach { buffer.add(it.toByte()) }
        fun addText(text: String) {
            try {
                // Use Windows-1252 for French characters (é, è, ê, â, ô, ç, ù, à)
                val encoded = text.toByteArray(Charset.forName("windows-1252"))
                buffer.addAll(encoded.toList())
            } catch (e: Exception) {
                // Fallback to UTF-8
                buffer.addAll(text.toByteArray(Charsets.UTF_8).toList())
            }
        }
        fun newLine() = addBytes(0x0A)
        fun centerOn() = addBytes(0x1B, 0x61, 0x01) // ESC a 1
        fun centerOff() = addBytes(0x1B, 0x61, 0x00) // ESC a 0
        fun boldOn() = addBytes(0x1B, 0x45, 0x01) // ESC E 1
        fun boldOff() = addBytes(0x1B, 0x45, 0x00) // ESC E 0
        fun doubleHeight() = addBytes(0x1D, 0x21, 0x01) // GS ! 1
        fun normalSize() = addBytes(0x1D, 0x21, 0x00) // GS ! 0
        
        fun separator() {
            addText(separatorChar.toString().repeat(lineWidth))
            newLine()
        }
        
        fun formatLine(left: String, right: String): String {
            val maxLeft = lineWidth - right.length - 1
            val truncatedLeft = if (left.length > maxLeft) left.take(maxLeft - 2) + ".." else left
            val padding = lineWidth - truncatedLeft.length - right.length
            return truncatedLeft + " ".repeat(padding.coerceAtLeast(1)) + right
        }
        
        // === Initialize Printer ===
        addBytes(0x1B, 0x40) // ESC @ - Initialize
        addBytes(0x1B, 0x74, 0x10) // ESC t 16 - Select Windows-1252 code page
        
        // === Header ===
        val header = data.getString("header") ?: "CaissaPro"
        val subheader = data.getString("subheader") ?: ""
        val phone = data.getString("phone") ?: ""
        
        if (centerHeader) centerOn()
        boldOn()
        doubleHeight()
        addText(header)
        newLine()
        normalSize()
        boldOff()
        
        if (subheader.isNotEmpty()) {
            addText(subheader)
            newLine()
        }
        if (phone.isNotEmpty()) {
            addText("Tél: $phone")
            newLine()
        }
        
        if (centerHeader) centerOff()
        newLine()
        separator()
        
        // === Order Info ===
        val showOrderNumber = !data.hasKey("showOrderNumber") || data.getBoolean("showOrderNumber")
        val showTableNumber = !data.hasKey("showTableNumber") || data.getBoolean("showTableNumber")
        val showDateTime = !data.hasKey("showDateTime") || data.getBoolean("showDateTime")
        val showWaiterName = !data.hasKey("showWaiterName") || data.getBoolean("showWaiterName")
        
        if (showOrderNumber) {
            val orderNumber = data.getString("orderNumber") ?: ""
            if (orderNumber.isNotEmpty()) {
                addText("N° Commande: $orderNumber")
                newLine()
            }
        }
        
        if (showTableNumber) {
            val tableNumber = data.getInt("tableNumber")
            if (tableNumber > 0) {
                addText("Table: $tableNumber")
                newLine()
            }
        }
        
        if (showWaiterName) {
            val waiterName = data.getString("waiterName") ?: ""
            if (waiterName.isNotEmpty()) {
                addText("Serveur: $waiterName")
                newLine()
            }
        }
        
        if (showDateTime) {
            val date = data.getString("date") ?: ""
            if (date.isNotEmpty()) {
                addText("Date: $date")
                newLine()
            }
        }
        
        separator()
        
        // === Items ===
        val items = data.getArray("items")
        if (items != null) {
            for (i in 0 until items.size()) {
                val item = items.getMap(i)
                if (item != null) {
                    val name = item.getString("name") ?: "?"
                    val quantity = item.getInt("quantity")
                    val price = item.getDouble("price")
                    val total = item.getDouble("total")
                    
                    // Format: "2x Article Name           50.00"
                    val qtyPrefix = "${quantity}x "
                    val priceStr = String.format("%.2f", total)
                    val maxNameLen = lineWidth - qtyPrefix.length - priceStr.length - 1
                    val truncName = if (name.length > maxNameLen) name.take(maxNameLen - 2) + ".." else name
                    
                    addText(formatLine("$qtyPrefix$truncName", priceStr))
                    newLine()
                }
            }
        }
        
        separator()
        
        // === Totals ===
        val showSubtotal = !data.hasKey("showSubtotal") || data.getBoolean("showSubtotal")
        val subtotal = data.getDouble("subtotal")
        val discount = data.getDouble("discount")
        val total = data.getDouble("total")
        
        if (showSubtotal && subtotal > 0) {
            addText(formatLine("Sous-total:", String.format("%.2f DH", subtotal)))
            newLine()
        }
        
        if (discount > 0) {
            addText(formatLine("Remise:", String.format("-%.2f DH", discount)))
            newLine()
        }
        
        // Total line - bold and larger
        if (boldTotal) boldOn()
        doubleHeight()
        addText(formatLine("TOTAL:", String.format("%.2f DH", total)))
        newLine()
        normalSize()
        if (boldTotal) boldOff()
        
        separator()
        
        // === Payment Details ===
        val showPaymentDetails = !data.hasKey("showPaymentDetails") || data.getBoolean("showPaymentDetails")
        if (showPaymentDetails) {
            val paymentMethod = data.getString("paymentMethod") ?: ""
            val amountReceived = data.getDouble("amountReceived")
            val change = data.getDouble("change")
            
            if (paymentMethod.isNotEmpty()) {
                addText(formatLine("Paiement:", paymentMethod))
                newLine()
            }
            
            if (amountReceived > 0 && paymentMethod.lowercase().contains("espèces")) {
                addText(formatLine("Reçu:", String.format("%.2f DH", amountReceived)))
                newLine()
                if (change > 0) {
                    addText(formatLine("Monnaie:", String.format("%.2f DH", change)))
                    newLine()
                }
            }
        }
        
        newLine()
        
        // === Footer ===
        val showFooter = !data.hasKey("showFooter") || data.getBoolean("showFooter")
        if (showFooter) {
            val footerMessage = data.getString("footerMessage") ?: "Merci de votre visite!"
            centerOn()
            addText(footerMessage)
            newLine()
            centerOff()
        }
        
        // === Feed and Cut ===
        newLine()
        newLine()
        newLine()
        
        if (autoCut) {
            addBytes(0x1D, 0x56, 0x01) // GS V 1 - Partial cut
        }
        
        return buffer.toByteArray()
    }

    @ReactMethod
    fun printTestPage(promise: Promise) {
        val testReceipt = """
            ================================
                   CAISSAPRO POS
                 TEST D'IMPRESSION
            ================================
            
            Date: ${java.text.SimpleDateFormat("dd/MM/yyyy HH:mm").format(java.util.Date())}
            
            --------------------------------
            Article Test           10.00 DH
            Café crème              8.50 DH
            Thé à la menthe         6.00 DH
            --------------------------------
            TOTAL                  24.50 DH
            ================================
            
            Caractères: é è ê â ô ç ù à
                 Imprimante OK!
                 
            ================================
            
            
            
        """.trimIndent()
        
        printText(testReceipt, promise)
    }

    @ReactMethod
    fun openCashDrawer(promise: Promise) {
        thread {
            try {
                if (connectionState != STATE_CONNECTED) {
                    promise.reject("NOT_CONNECTED", "Imprimante non connectée")
                    return@thread
                }

                val outputStream = getActiveOutputStream()
                if (outputStream == null) {
                    promise.reject("NO_OUTPUT", "Flux de sortie non disponible")
                    return@thread
                }

                // ESC p m t1 t2 - Open cash drawer
                val openDrawer = byteArrayOf(0x1B, 0x70, 0x00, 0x19, 0xFA.toByte())
                outputStream.write(openDrawer)
                outputStream.flush()

                Log.i(TAG, "Cash drawer opened")
                promise.resolve(1)
            } catch (e: Exception) {
                Log.e(TAG, "openCashDrawer error: ${e.message}")
                promise.reject("DRAWER_ERROR", "Erreur: ${e.message}")
            }
        }
    }

    // ============================================================================
    // HELPERS
    // ============================================================================

    private fun getActiveOutputStream(): OutputStream? {
        return when (currentTransport) {
            TRANSPORT_BLUETOOTH -> btOutputStream
            TRANSPORT_WIFI -> wifiOutputStream
            else -> null
        }
    }

    private fun hasBluetoothPermissions(): Boolean {
        val context = reactApplicationContext
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == 
                PackageManager.PERMISSION_GRANTED
        } else {
            true // Older Android versions don't need runtime permissions for Bluetooth
        }
    }

    private fun handleConnectionLost() {
        connectionState = STATE_DISCONNECTED
        currentTransport = null
        currentDeviceAddress = null
        sendEvent("EVENT_CONNECTION_LOST", null)
    }

    @SuppressLint("MissingPermission")
    private fun sendDeviceFoundEvent(device: BluetoothDevice) {
        sendEvent("EVENT_DEVICE_FOUND", Arguments.createMap().apply {
            putString("address", device.address)
            putString("name", device.name ?: "Appareil inconnu")
            putInt("type", device.type)
        })
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    // ============================================================================
    // LIFECYCLE
    // ============================================================================

    override fun onHostResume() {
        // Reconnect if needed
    }

    override fun onHostPause() {
        // Keep connection alive in background
    }

    override fun onHostDestroy() {
        disconnectInternal()
        discoveryReceiver?.let {
            try {
                reactApplicationContext.unregisterReceiver(it)
            } catch (e: Exception) {
                // Ignore
            }
        }
    }

    // Required for NativeEventEmitter
    @ReactMethod
    fun addListener(eventName: String) {
        // Keep track of listeners
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Remove listeners
    }
}
