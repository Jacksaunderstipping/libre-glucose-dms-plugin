import QtQuick
import qs.Common
import qs.Widgets
import qs.Modules.Plugins

PluginSettings {
    id: root
    pluginId: "libreGlucose"

    StyledText {
        width: parent.width
        text: "Libre Glucose Monitor Settings"
        font.pixelSize: Theme.fontSizeLarge
        font.weight: Font.Bold
        color: Theme.surfaceText
    }

    StyledText {
        width: parent.width
        text: "Connect to your LibreLinkUp account to display blood glucose readings."
        font.pixelSize: Theme.fontSizeSmall
        color: Theme.surfaceVariantText
        wrapMode: Text.WordWrap
    }

    StringSetting {
        settingKey: "username"
        label: "Email Address"
        description: "Your LibreLinkUp account email"
        placeholder: "email@example.com"
        defaultValue: ""
    }

    StringSetting {
        settingKey: "password"
        label: "Password"
        description: "Your LibreLinkUp account password"
        placeholder: "Enter password"
        defaultValue: ""
    }

    SliderSetting {
        settingKey: "refreshInterval"
        label: "Refresh Interval"
        description: "How often to fetch glucose readings (in seconds). Note: Libre sensors update every ~1 minute."
        defaultValue: 60
        minimum: 30
        maximum: 300
        unit: "s"
        leftIcon: "schedule"
    }

    SelectionSetting {
        settingKey: "glucoseUnit"
        label: "Glucose Unit"
        options: [
            { label: "mmol/L", value: "mmol/L" },
            { label: "mg/dL", value: "mg/dL" }
        ]
        defaultValue: "mmol/L"
    }

    SliderSetting {
        settingKey: "lowThreshold"
        label: "Low Threshold"
        description: "Values below this will be shown in red (typical: 4)"
        defaultValue: 4
        minimum: 3
        maximum: 6
        unit: "mmol/L"
        leftIcon: "arrow_downward"
    }

    SliderSetting {
        settingKey: "highThreshold"
        label: "High Threshold"
        description: "Values above this will be shown in orange (typical: 10)"
        defaultValue: 10
        minimum: 7
        maximum: 14
        unit: "mmol/L"
        leftIcon: "arrow_upward"
    }

    StyledText {
        width: parent.width
        text: "Your credentials are stored locally and used only to authenticate with LibreLinkUp."
        font.pixelSize: Theme.fontSizeSmall
        color: Theme.surfaceVariantText
        wrapMode: Text.WordWrap
    }
}
