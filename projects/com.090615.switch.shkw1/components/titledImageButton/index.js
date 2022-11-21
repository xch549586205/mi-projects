import { Dimensions } from "react-native";
import React, { PureComponent } from "react";
import { StyleSheet, View, Text } from "react-native";

const window = Dimensions.get("window");
export const WIDTH = window.width;
function adjustSize(n) {
  return (n / 360) * WIDTH;
}
export default function (Button) {
  return class extends PureComponent {
    render() {
      let { title, on, direction, ...rest } = this.props;
      const titleOnStyle =
        direction === "row" ? Styles.titleOnRow : Styles.titleOnColumn;
      const titleOffStyle =
        direction === "row" ? Styles.titleOffRow : Styles.titleOffColumn;
      let titleStyle = on ? titleOnStyle : titleOffStyle;
      return (
        <View
          style={{
            display: "flex",
            flexDirection: direction === "row" ? "row" : "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <Button on={on} {...rest} style={{ padding: "20px" }} />
          <Text style={titleStyle}>{title}</Text>
        </View>
      );
    }
  };
}

const Styles = StyleSheet.create({
  titleOnRow: {
    // marginLeft: adjustSize(16),
    fontSize: adjustSize(13),
    color: "#32BAC0",
  },
  titleOffRow: {
    fontSize: adjustSize(13),
    color: "#999999",
    // marginLeft: adjustSize(16),
  },
  titleOnColumn: {
    marginTop: adjustSize(8),
    fontSize: adjustSize(13),
    color: "#32BAC0",
  },
  titleOffColumn: {
    fontSize: adjustSize(13),
    color: "#999999",
    marginTop: adjustSize(8),
  },
});
