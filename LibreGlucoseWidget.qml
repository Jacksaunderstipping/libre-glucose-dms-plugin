import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Io
import qs.Common
import qs.Services
import qs.Widgets
import qs.Modules.Plugins

PluginComponent {
    id: root

    property string username: pluginData.username || ""
    property string password: pluginData.password || ""
    property int refreshInterval: (pluginData.refreshInterval || 60) * 1000
    property string glucoseValue: "--"
    property string glucoseTrend: ""
    property string trendArrow: ""
    property string levelIndicator: ""
    property string lastUpdate: ""
    property bool isLoading: true
    property bool hasError: false
    property string errorMessage: ""
    property string glucoseUnit: pluginData.glucoseUnit || "mmol/L"
    property color glucoseColor: Theme.surfaceText

    // Thresholds (integers for slider compatibility)
    property int lowThreshold: pluginData.lowThreshold || 4
    property int highThreshold: pluginData.highThreshold || 10

    popoutWidth: 250
    popoutHeight: 200

    pillClickAction: () => {
        fetchGlucose()
    }

    Component.onCompleted: {
        if (username && password) {
            fetchGlucose()
        } else {
            hasError = true
            errorMessage = "Configure credentials"
            isLoading = false
        }
    }

    function fetchGlucose() {
        isLoading = true
        hasError = false
        glucoseFetcher.running = true
    }

    // Backend process using Node.js
    Process {
        id: glucoseFetcher
        command: ["node", Qt.resolvedUrl("libre-backend.js").toString().replace("file://", "")]

        stdout: SplitParser {
            onRead: data => {
                try {
                    const result = JSON.parse(data)

                    if (result.error) {
                        root.hasError = true
                        root.errorMessage = result.error
                        root.glucoseValue = "--"
                        root.trendArrow = ""
                        root.glucoseColor = Theme.surfaceText
                    } else {
                        root.hasError = false
                        root.glucoseValue = result.value
                        root.glucoseTrend = result.trend || ""
                        root.trendArrow = result.arrow || ""
                        root.levelIndicator = result.level || ""
                        root.glucoseColor = result.color || Theme.surfaceText
                        root.lastUpdate = new Date().toLocaleTimeString(Qt.locale(), "HH:mm")
                    }
                } catch (e) {
                    console.error("LibreGlucose: Parse error:", e)
                    root.hasError = true
                    root.errorMessage = "Parse error"
                    root.glucoseValue = "--"
                }
                root.isLoading = false
            }
        }

        stderr: SplitParser {
            onRead: data => {
                console.error("LibreGlucose stderr:", data)
            }
        }

        onExited: (exitCode, exitStatus) => {
            if (exitCode !== 0 && !root.hasError) {
                root.hasError = true
                root.errorMessage = "Backend error"
                root.glucoseValue = "--"
            }
            root.isLoading = false
        }

        running: false
    }

    // Auto-refresh timer
    Timer {
        id: refreshTimer
        interval: root.refreshInterval
        running: root.username !== "" && root.password !== ""
        repeat: true
        onTriggered: root.fetchGlucose()
    }

    horizontalBarPill: Component {
        Row {
            spacing: Theme.spacingXS
            rightPadding: Theme.spacingS

            DankIcon {
                name: "water_drop"
                size: Theme.fontSizeMedium
                color: root.glucoseColor
                anchors.verticalCenter: parent.verticalCenter
            }

            StyledText {
                text: root.glucoseValue + (root.trendArrow ? " " + root.trendArrow : "")
                font.pixelSize: Theme.fontSizeSmall
                color: root.glucoseColor
                anchors.verticalCenter: parent.verticalCenter
            }

            DankIcon {
                name: "sync"
                size: Theme.fontSizeSmall
                color: Theme.surfaceTextVariant
                visible: root.isLoading
                anchors.verticalCenter: parent.verticalCenter
            }

            DankIcon {
                name: "warning"
                size: Theme.fontSizeSmall
                color: "#E53935"
                visible: root.hasError && !root.isLoading
                anchors.verticalCenter: parent.verticalCenter
            }
        }
    }

    verticalBarPill: Component {
        Column {
            spacing: Theme.spacingXS

            DankIcon {
                name: "water_drop"
                size: Theme.fontSizeMedium
                color: root.glucoseColor
                anchors.horizontalCenter: parent.horizontalCenter
            }

            StyledText {
                text: root.glucoseValue
                font.pixelSize: Theme.fontSizeSmall
                color: root.glucoseColor
                anchors.horizontalCenter: parent.horizontalCenter
            }

            StyledText {
                text: root.trendArrow
                font.pixelSize: Theme.fontSizeSmall
                color: root.glucoseColor
                visible: root.trendArrow !== ""
                anchors.horizontalCenter: parent.horizontalCenter
            }
        }
    }

    popoutContent: Component {
        Rectangle {
            color: Theme.surfaceContainer
            radius: 12

            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 16
                spacing: 12

                Row {
                    spacing: 8
                    DankIcon {
                        name: "water_drop"
                        size: 24
                        color: root.glucoseColor
                    }
                    StyledText {
                        text: "Blood Glucose"
                        font.pixelSize: 16
                        font.bold: true
                        color: Theme.surfaceText
                    }
                }

                StyledText {
                    text: root.glucoseValue + " " + root.trendArrow
                    font.pixelSize: 48
                    font.bold: true
                    color: root.glucoseColor
                    Layout.alignment: Qt.AlignHCenter
                }

                StyledText {
                    text: root.glucoseUnit
                    font.pixelSize: 14
                    color: Theme.surfaceTextVariant
                    Layout.alignment: Qt.AlignHCenter
                }

                StyledText {
                    text: root.hasError ? root.errorMessage : "Updated: " + root.lastUpdate
                    font.pixelSize: 12
                    color: root.hasError ? "#E53935" : Theme.surfaceTextVariant
                    Layout.alignment: Qt.AlignHCenter
                }

                Rectangle {
                    Layout.fillWidth: true
                    height: 36
                    color: Theme.primary
                    radius: 8

                    StyledText {
                        anchors.centerIn: parent
                        text: root.isLoading ? "Refreshing..." : "Refresh Now"
                        color: Theme.onPrimary
                        font.pixelSize: 14
                    }

                    MouseArea {
                        anchors.fill: parent
                        enabled: !root.isLoading
                        onClicked: root.fetchGlucose()
                    }
                }
            }
        }
    }
}
