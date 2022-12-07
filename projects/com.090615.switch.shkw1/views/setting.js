"use strict";
import React from "react";
import { StyleSheet, View, ScrollView, Platform, Text } from "react-native";

import { Styles } from "miot/resources";
import {
  CommonSetting,
  SETTING_KEYS,
  MultiSwitchSetting,
} from "miot/ui/CommonSetting";
import ChoiceDialog from "miot/ui/Dialog/ChoiceDialog";
import { ListItem } from "miot/ui/ListItem";
import Separator from "miot/ui/Separator";
import PluginStrings from "../resources/strings";
import { Device, Service, DeviceEvent, PackageEvent, Host } from "miot";

import Navigator from "../modules/navigator";
import Protocol from "../modules/protocol";
import {
  LocalizedString,
  NOOP,
  PROTOCOLCACHEKEY,
  DeviceID,
  defaultPowerOnStateKey,
  indicatorLightKey,
  SwitchKey,
  rangeKey,
  adjustSize,
  getDefinitionWithKeyFromInstance,
  getInstanceFromCache,
  getInstanceFromNet,
  formatTimerTime,
  fixNum,
} from "../modules/consts";
import { LoadingDialog } from "miot/ui";

const { first_options, second_options } = SETTING_KEYS;
const params = [rangeKey, defaultPowerOnStateKey];

export default class Setting extends React.Component {
  static navigationOptions = ({ navigation }) => {
    return {
      header: <Navigator navigation={navigation} />,
    };
  };

  paramInfos = {};
  getting = false;

  constructor(props) {
    super(props);
    this.initProtocol();
    loop = null;
    lastControl = 0;
    this.state = {
      showDialog: false,
      dialogTimeout: 0,
      dialogTitle: "",
      status: {},
      visible1: false,
      visible2: false,
      // dialog
      showDialog: false,
      dialogTimeout: 0,
      dialogTitle: "",
    };
  }

  initProtocol = () => {
    Host.storage
      .get(PROTOCOLCACHEKEY)
      .then((cache) => {
        if (cache) {
          return;
        }
        // Host.ui
        //   .alertLegalInformationAuthorization(Protocol)
        //   .then((agreed) => {
        //     if (agreed) {
        //       Host.storage.set(PROTOCOLCACHEKEY, true);
        //     }
        //   })
        //   .catch((_) => {});
      })
      .catch((_) => {});
  };

  control = (cmd) => {
    this.showLoadingTips(LocalizedString.handling());
    console.log(this.state.status, "this.state.status");

    const newStatus = { ...this.state.status };

    let cmdParam, cmdValue;
    for (const key in cmd) {
      cmdParam = key;
      cmdValue = cmd[key];
    }

    // 防止高频提交
    if (this.state.isHandling) {
      console.log("上一条控制指令处理中，本次点击控制不生效--------------");
      this.showFailTips("点击太快，请稍候...", 500);
      return;
    }

    this.setState({
      isHandling: true,
    });

    if (!newStatus[cmdParam]) {
      return;
    }
    const controlParams = Object.assign({
      piid: newStatus[cmdParam].piid,
      siid: newStatus[cmdParam].siid,
      value: cmdValue,
    });
    clearTimeout(this.loop);
    this.loop = null;

    // 页面状态先变化
    newStatus[cmdParam].value = cmdValue;
    this.setState({ status: newStatus });

    // 记录控制时间戳
    this.lastControl = new Date().valueOf();
    console.log(controlParams, "发送控制命令参数-------------");
    // 控制后2秒查一下
    this.loop = setTimeout(() => {
      this.getDeviceProps();
    }, 2500);
    Service.spec
      .setPropertiesValue([Object.assign({ did: DeviceID }, controlParams)])
      .then((res) => {
        let code = res[0].code;
        // 1表示处理中，这里不处理，等消息推送
        if (code === 1) {
          return;
        }
        if (code === 0) {
          console.log(res, "控制命令成功结果-------------");
          newStatus[cmdParam].value = cmdValue;
          this.setState({ status: newStatus });
          this.dismissTips();
          return;
        }
        console.log(res, "控制命令失败结果-------------");
        this.showFailTips(LocalizedString.failed());
      })
      .catch((error) => {
        console.log(error, "控制命令失败结果-------------");
        this.showFailTips(LocalizedString.failed());
      })
      .finally(() => {
        this.setState({
          isHandling: false,
        });
      });
  };

  getDeviceProps = (cb) => {
    let propertys = [];
    for (const key in this.paramInfos) {
      propertys.push(
        Object.assign(
          { did: DeviceID },
          { siid: this.paramInfos[key].siid, piid: this.paramInfos[key].piid }
        )
      );
    }
    if (this.getting || !propertys.length) {
      return;
    }
    console.log(propertys, "发送查询状态命令参数-------------");
    this.getting = true;
    Service.spec
      .getPropertiesValue(propertys)
      .then((res) => {
        let newStatus = this.formatDeviceProps(res);
        const isChange =
          JSON.stringify(newStatus) !== JSON.stringify(this.state.status);
        clearTimeout(this.loop);
        this.loop = null;

        const resTime = new Date().valueOf();
        const isPrevGet = this.lastControl && resTime < this.lastControl;
        if (isPrevGet) {
          console.log("是上一次的查询请求-------------");
          return;
        }

        if (isChange) {
          console.log(newStatus, "查询状态有变化-------------");
          this.setState({
            status: newStatus,
          });
        } else {
          console.log("查询状态没没没没没没没有变化-------------");
        }
        if (typeof cb === "function") {
          cb(res);
        }
      })
      .catch((error) => {
        console.log(error, "查询状态失败-------------");
      })
      .finally(() => {
        this.getting = false;
      });
  };

  formatDeviceProps = (values) => {
    const status = { ...this.paramInfos };
    for (let value of values) {
      if (value.code !== 0) {
        continue;
      }
      let siid = value.siid,
        piid = value.piid;
      for (const key in this.paramInfos) {
        if (
          this.paramInfos[key].siid === siid &&
          this.paramInfos[key].piid === piid
        ) {
          status[key] = { ...this.paramInfos[key], ...value };
        }
      }
    }
    return status;
  };

  updateInstance = (instance) => {
    console.log(instance, "设备参数信息返回结果instance");

    if (!instance || Object.keys(this.paramInfos).length > 0) {
      return;
    }
    let supports = {};
    let supportCount = 0;
    let paramInfos = getDefinitionWithKeyFromInstance(instance, params);
    console.log(paramInfos, "设备参数信息返回结果paramInfos");
    this.paramInfos = paramInfos;
    if (supportCount) {
      this.setState(supports);
    }
    this.getDeviceProps(this.getTimerList);

    // if (!this.loop) {
    //   console.log("开始轮询！", this.getDeviceProps);
    //   this.loop = setInterval(() => {
    //     this.getDeviceProps();
    //   }, 1000);
    // }
    this.initPropsSubscription(paramInfos);
  };

  initPropsSubscription = (paramInfos) => {
    // 状态订阅, 实时监听状态
    let props = [];
    for (const key in paramInfos) {
      const param = paramInfos[key];
      props.push(`prop.${param.siid}.${param.piid}`);
    }
    if (!props.length) {
      return;
    }
    this.messageSubscription = DeviceEvent.deviceReceivedMessages.addListener(
      this.handleReceivedMessage
    );
    Device.getDeviceWifi()
      .subscribeMessages(...props)
      .then((subscription) => {
        this.propsSubscription = subscription;
      })
      .catch(NOOP);
  };

  handleReceivedMessage = (device, message) => {
    if (!message) {
      return;
    }
    const newStatus = { ...this.state.status };
    for (const key in newStatus) {
      const param = newStatus[key];
      const value = message.get(`prop.${param.siid}.${param.piid}`);
      if (value && !this.loop) {
        newStatus[key].value = value[0];
        console.info(param, value, "from websocket-------------状态有新的变化");
        this.setState({ status: newStatus });
      }
    }
  };

  componentDidMount() {
    this.props.navigation.setParams({
      hideRightButton: true,
    });

    // 从其他rn页面返回
    this.viewFocusListener && this.viewFocusListener.remove();
    // 从原生页面返回
    this.viewAppearListener && this.viewAppearListener.remove();

    getInstanceFromCache(this.updateInstance);
    getInstanceFromNet(this.updateInstance);
  }
  componentWillUnmount() {
    this.viewFocusListener && this.viewFocusListener.remove();
    this.viewAppearListener && this.viewAppearListener.remove();

    this.messageSubscription && this.messageSubscription.remove();
    this.propsSubscription && this.propsSubscription.remove();

    this.rafBrightness && cancelAnimationFrame(this.rafBrightness);
    this.rafTemperature && cancelAnimationFrame(this.rafTemperature);

    this.intervalTimerState && clearInterval(this.intervalTimerState);

    this.firmwareChange && this.firmwareChange.remove();
  }

  _getCommonSettingStyle() {
    let style = {
      allowFontScaling: true,
      unlimitedHeightEnable: false,
      titleContainer: {},
      titleStyle: {},
      itemStyle: {
        allowFontScaling: true,
        unlimitedHeightEnable: false,
        titleStyle: null,
        subtitleStyle: null,
        valueStyle: null,
        dotStyle: null,
        titleNumberOfLines: 1,
        subtitleNumberOfLines: 2,
        valueNumberOfLines: 2,
        // valueMaxWidth 这里不设置默认值，直接用ListItem 里的
        // valueMaxWidth: '30%',
        useNewType: false,
      },
      bottomContainer: {},
      deleteTextStyle: {},
    };
    if (this.props.commonSettingStyle) {
      if (this.props.commonSettingStyle.hasOwnProperty("allowFontScaling")) {
        style.allowFontScaling = this.props.commonSettingStyle.allowFontScaling;
      }
      if (
        this.props.commonSettingStyle.hasOwnProperty("unlimitedHeightEnable")
      ) {
        style.unlimitedHeightEnable =
          this.props.commonSettingStyle.unlimitedHeightEnable;
      }
      if (this.props.commonSettingStyle.hasOwnProperty("titleContainer")) {
        style.titleContainer = this.props.commonSettingStyle.titleContainer;
      }
      if (this.props.commonSettingStyle.hasOwnProperty("titleStyle")) {
        style.titleStyle = this.props.commonSettingStyle.titleStyle;
      }
      if (this.props.commonSettingStyle.hasOwnProperty("itemStyle")) {
        style.itemStyle = this.props.commonSettingStyle.itemStyle;
      }
      if (this.props.commonSettingStyle.hasOwnProperty("bottomContainer")) {
        style.bottomContainer = this.props.commonSettingStyle.bottomContainer;
      }
      if (this.props.commonSettingStyle.hasOwnProperty("deleteTextStyle")) {
        style.deleteTextStyle = this.props.commonSettingStyle.deleteTextStyle;
      }
    }
    style.itemStyle.allowFontScaling = style.allowFontScaling;
    style.itemStyle.unlimitedHeightEnable = style.unlimitedHeightEnable;
    return style;
  }

  render() {
    const { status } = this.state;
    let tempCommonSettingStyle = this._getCommonSettingStyle();
    const isDefaultPowerOnStateKeyValue =
      status[defaultPowerOnStateKey] &&
      status[defaultPowerOnStateKey].value === 1;

    const isDefaultPowerOnStateKeyText =
      status[defaultPowerOnStateKey] &&
      status[defaultPowerOnStateKey].value === 1
        ? "记忆"
        : "关闭";
    const rangeVale = status[rangeKey] ? status[rangeKey].value : 0;
    let { showDialog, dialogTimeout, dialogTitle } = this.state;
    // 显示部分一级菜单项
    const firstOptions = [
      first_options.SHARE,
      first_options.IFTTT,
      first_options.FIRMWARE_UPGRADE,
    ];
    // 显示部分二级菜单项
    const secondOptions = [second_options.TIMEZONE];
    // 显示固件升级二级菜单
    const extraOptions = {
      option: Protocol,
      showUpgrade: true,
    };
    const rangeList = [10, 20, 25, 30, 35];
    return (
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View
            style={[
              styles.titleContainer,
              tempCommonSettingStyle.titleContainer,
            ]}
          >
            <Text
              style={[styles.title, tempCommonSettingStyle.titleStyle]}
              allowFontScaling={tempCommonSettingStyle.allowFontScaling}
            >
              {PluginStrings.commonSetting}
            </Text>
          </View>
          <ListItem
            title="上电状态"
            value={isDefaultPowerOnStateKeyText}
            showSeparator={false}
            onPress={() => {
              this.setState({ visible1: true });
            }}
          />
          <ListItem
            title="雷达感应距离"
            value={status[rangeKey] ? status[rangeKey].value + "" : "--"}
            onPress={() => this.setState({ visible2: true })}
          />
          <CommonSetting
            navigation={this.props.navigation}
            firstOptions={firstOptions}
            showDot={this.state.showDot}
            secondOptions={secondOptions}
            extraOptions={extraOptions}
          />
          <View style={{ height: 20 }} />
        </ScrollView>
        <ChoiceDialog
          visible={this.state.visible1}
          title={"上电状态设置"}
          options={[
            {
              title: "关闭",
            },
            {
              title: "记忆",
            },
          ]}
          selectedIndexArray={[isDefaultPowerOnStateKeyValue ? 1 : 0]}
          onSelect={(result) => {
            this.control({
              [defaultPowerOnStateKey]: result[0],
            });
            this.setState({ visible1: false });
          }}
        />
        <ChoiceDialog
          visible={this.state.visible2}
          title={"雷达感应距离设置"}
          options={rangeList.map((r) => ({
            title: r + " mm",
          }))}
          selectedIndexArray={[rangeList.indexOf(rangeVale)]}
          onSelect={(result) => {
            this.control({
              [rangeKey]: rangeList[result[0]],
            });
            this.setState({ visible2: false });
          }}
        />
        <LoadingDialog
          visible={showDialog}
          message={dialogTitle}
          timeout={dialogTimeout}
        />
      </View>
    );
  }

  showLoadingTips = (tip) => {
    return;
  };

  dismissTips = () => {
    this.timerTips && clearTimeout(this.timerTips);
    setTimeout(() => {
      this.setState({
        showDialog: false,
        dialogTimeout: 0,
        dialogTitle: "",
      });
    }, 300);
  };

  showFailTips = (tip) => {
    this.setState({
      showDialog: true,
      dialogTimeout: 300,
      dialogTitle: tip,
    });
    this.timerTips && clearTimeout(this.timerTips);
    this.timerTips = setTimeout(() => {
      this.dismissTips();
    }, 300);
  };
}

var styles = StyleSheet.create({
  container: {
    backgroundColor: Styles.common.backgroundColor,
    flex: 1,
  },
  featureSetting: {
    backgroundColor: "#fff",
  },
  blank: {
    height: 8,
    backgroundColor: Styles.common.backgroundColor,
    borderTopColor: Styles.common.hairlineColor,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Styles.common.hairlineColor,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleContainer: {
    height: 32,
    backgroundColor: "#fff",
    justifyContent: "center",
    paddingLeft: Styles.common.padding,
  },
  title: {
    fontSize: 11,
    color: "rgba(0,0,0,0.5)",
    lineHeight: 14,
  },
});
