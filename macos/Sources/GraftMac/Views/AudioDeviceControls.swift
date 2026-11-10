import GraftAudio
import SwiftUI

struct AudioDeviceControls: View {
    let engine: AudioEngine
    let device: AudioDevice
    var input = false
    @State private var expanded = false
    private var monitor: any DeviceVolumeProviding { engine.deviceVolumeMonitor }
    private var isDefault: Bool { (input ? monitor.defaultInputDeviceUID : monitor.defaultDeviceUID) == device.uid }

    var body: some View {
        VStack(spacing: 0) {
            GraftRow {
                Button { expanded.toggle() } label: { GraftDisclosureChevron(isExpanded: expanded) }
                    .buttonStyle(.plain).accessibilityLabel("\(device.name) options")
                GraftRowLabel(title: device.name, detail: isDefault ? "System default" : nil, symbol: input ? "mic" : "speaker.wave.2", tint: .purple)
                Slider(value: Binding(get: { Double((input ? monitor.inputVolumes : monitor.volumes)[device.id] ?? 1) }, set: {
                    if input { monitor.setInputVolume(for: device.id, to: Float($0)) }
                    else { monitor.setVolume(for: device.id, to: Float($0)) }
                }), in: 0...1).frame(width: 120).accessibilityLabel("\(device.name) volume")
                    .disabled(input ? !device.id.hasInputVolumeControl() : !engine.hasVolumeControl(for: device.id))
                Button {
                    if input { monitor.setInputMute(for: device.id, to: !(monitor.inputMuteStates[device.id] ?? false)) }
                    else { monitor.setMute(for: device.id, to: !(monitor.muteStates[device.id] ?? false)) }
                } label: {
                    Image(systemName: (input ? monitor.inputMuteStates : monitor.muteStates)[device.id] == true ? "speaker.slash.fill" : "speaker.wave.2.fill")
                }.accessibilityLabel("Toggle \(device.name) mute")
            }
            if expanded {
                GraftSettingsSubGroup("Device options") {
                    GraftRow {
                        Button("Use as Default") {
                            if input {
                                if engine.settingsManager.appSettings.lockInputDevice { engine.setLockedInputDevice(device) }
                                else { _ = monitor.setDefaultInputDevice(device.id) }
                            } else { _ = engine.setDefaultOutputDevice(device.id) }
                        }.disabled(isDefault)
                        Spacer()
                        Button("Prefer on Connect") { preferDevice() }
                            .help("Move this device to the top of the saved device priority order")
                    }
                    if !input {
                        if !engine.hasVolumeControl(for: device.id) {
                            GraftRow { Text("This output has no available volume control. Enable Software Output Volume in Audio Settings to adjust it.").font(.caption).foregroundStyle(.secondary) }
                        }
                        if device.supportsAutoEQ {
                            GraftRow {
                                NavigationLink("Headphone Correction") { AudioCorrectionView(engine: engine, device: device) }
                                Spacer()
                                Text(engine.getAutoEQProfile(for: device.uid)?.name ?? "Off").font(.caption).foregroundStyle(.secondary).lineLimit(1)
                            }
                        }
                        GraftRow { Text("Volume backend"); Spacer(); Text(String(describing: engine.outputVolumeBackend(for: device.id)).capitalized).foregroundStyle(.secondary) }
                    }
                }.padding(.leading, GraftMetrics.labelInset).padding(.trailing, GraftMetrics.rowHorizontalPadding).padding(.bottom, 12)
            }
        }
    }

    private func preferDevice() {
        var order = input ? engine.settingsManager.inputDevicePriorityOrder : engine.settingsManager.devicePriorityOrder
        order.removeAll { $0 == device.uid }
        order.insert(device.uid, at: 0)
        if input { engine.settingsManager.setInputDevicePriorityOrder(order) }
        else { engine.settingsManager.setDevicePriorityOrder(order) }
    }
}

struct AudioBluetoothControls: View {
    let engine: AudioEngine
    @State private var showing = false
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            GraftRow {
                Button(showing ? "Refresh Paired Bluetooth Devices" : "Show Paired Bluetooth Devices") {
                    showing = true
                    engine.bluetoothDeviceMonitor.start()
                    engine.bluetoothDeviceMonitor.refresh()
                }
            }
            if showing {
                if engine.bluetoothDeviceMonitor.pairedDevices.isEmpty {
                    GraftRow { Text("No disconnected paired audio devices found.").foregroundStyle(.secondary) }
                }
                ForEach(engine.bluetoothDeviceMonitor.pairedDevices) { device in
                    GraftRow {
                        GraftRowLabel(title: device.name, detail: engine.bluetoothDeviceMonitor.connectionErrors[device.id], symbol: "headphones")
                        Button(engine.bluetoothDeviceMonitor.connectingIDs.contains(device.id) ? "Connecting…" : "Connect") { engine.bluetoothDeviceMonitor.connect(device: device) }
                            .disabled(engine.bluetoothDeviceMonitor.connectingIDs.contains(device.id))
                    }
                }
            }
        }
    }
}
