import React, { Component } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  Platform,
  Dimensions,
  Animated,
  Slider,
  DeviceEventEmitter,
  ShadowPropTypesIOS,
} from "react-native";
import { SafeAreaView } from "react-navigation";
import {
  Device,
  Service,
  DeviceEvent,
  PackageEvent,
  Host,
  Bluetooth,
  BluetoothEvent,
  Util,
} from "miot";
import { LoadingDialog } from "miot/ui";
import Switch from "miot/ui/Switch";

import { SlideGear } from "miot/ui/Gear";
import PluginStrings from "../resources/strings";
import getPercent from "../modules/getPercent";
import Navigator from "../modules/navigator";
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

import Protocol from "../modules/protocol";

import DeviceButton from "../components/device";
import TimingImage from "../components/timing";
import SwitchImage from "../components/switch";
import CountdownImage from "../components/countdown";
import ImageButton from "../components/imageButton";
import TitledImageButton from "../components/titledImageButton";

import startOn from "./app/startOn.png";
import startOff from "./app/startOff.png";
import bgOff from "../resources/images/BG-OFF.png";
import bgOn from "../resources/images/BG-ON.png";
import light_off from "../resources/images/light_off.png";
import light_on from "../resources/images/light_on.png";
import power_off from "../resources/images/power_off.png";
import power_on from "../resources/images/power_on.png";

const { width } = Dimensions.get("screen");

const window = Dimensions.get("window");

const isIphoneX =
  Platform.OS === "ios" && window.width === 375 && window.height === 812;

const params = [rangeKey, SwitchKey, defaultPowerOnStateKey, indicatorLightKey];

export default class App extends Component {
  constructor(props) {
    super(props);
    this.initProtocol();
  }
  paramInfos = {};
  getting = false;
  loop = null;
  lastControl = 0;
  state = {
    on: false,
    timerInfo: "",
    containerBackgroundColor: new Animated.Value(0),
    timingTitle: LocalizedString.setTime(),
    timingActive: false,
    switchTitle: LocalizedString.switch(),
    countdownTitle: LocalizedString.timer(),
    countdownActive: false,

    // dialog
    showDialog: false,
    dialogTimeout: 0,
    dialogTitle: "",
    status: {},
    isOnline: true,
  };

  initProtocol = () => {
    Host.storage
      .get(PROTOCOLCACHEKEY)
      .then((cache) => {
        if (cache) {
          return;
        }
        Host.ui
          .alertLegalInformationAuthorization(Protocol)
          .then((agreed) => {
            if (agreed) {
              Host.storage.set(PROTOCOLCACHEKEY, true);
            }
          })
          .catch((_) => {});
      })
      .catch((_) => {});
  };

  SwitchBaseProps = null;

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
    }, 550);
  };

  showFailTips = (tip) => {
    this.setState({
      showDialog: true,
      dialogTimeout: 1200,
      dialogTitle: tip,
    });
    this.timerTips && clearTimeout(this.timerTips);
    this.timerTips = setTimeout(() => {
      this.dismissTips();
    }, 1200);
  };

  setHandling = (start, end) => {
    this.isHandling = true;
    this.stateAnimation && this.stateAnimation.stop();
    this.stateAnimation = Animated.timing(this.state.containerBackgroundColor, {
      toValue: end,
      duration: 550,
    });
    this.state.containerBackgroundColor.setValue(start);
    this.stateAnimation.start((e) => {
      if (e.finished) {
        this.setHandling(end, start);
      }
    });
  };

  setHandled = (on) => {
    this.stateAnimation && this.stateAnimation.stop();
    this.stateAnimation = Animated.timing(this.state.containerBackgroundColor, {
      toValue: on ? 1 : 0,
      duration: 1000,
    });
    this.stateAnimation.start(() => {
      this.isHandling = false;
      this.setState({
        on,
        isHandling: false,
      });
      this.updateTimerState();
      this.updateNavigationState();
    });
  };

  changeState = (on) => {
    if ((on !== true && on !== false) || on === this.state.on) {
      return;
    }
    this.setState({
      on,
    });
    this.updateTimerState();
    this.updateNavigationState();
    this.stateAnimation && this.stateAnimation.stop();
    this.stateAnimation = Animated.timing(this.state.containerBackgroundColor, {
      toValue: on ? 1 : 0,
      duration: 1000,
    });
    this.stateAnimation.start();
  };

  componentWillReceiveProps(nextProp) {
    console.log(this.props.value);
    this.setState({
      count: nextProp.value,
      jiuzhi: this.props.value,
    });
  }

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

  updateNavigationState = () => {
    this.props.navigation.setParams({
      barColor: this.state.on ? "white" : "black",
    });
  };

  getTimerList = () => {
    Service.scene
      .loadTimerScenes(DeviceID, {
        identify: DeviceID,
      })
      .then((_) => {
        this.timers = _;
        this.startUpdateTimerState();
      })
      .catch((_) => {});
  };

  startUpdateTimerState = () => {
    this.updateTimerState();
    this.intervalTimerState && clearInterval(this.intervalTimerState);
    this.intervalTimerState = setInterval(() => {
      this.updateTimerState();
    }, 2e3);
  };

  updateTimerState = () => {
    function getTimerInfo(scene, on) {
      if (!scene) {
        return "";
      }
      let time = scene.time;
      if (scene.timer.setting.timer_type !== "1") {
        return (
          on ? LocalizedString.timingTipOff : LocalizedString.timingTipOn
        )(`${fixNum(time.getHours())}:${fixNum(time.getMinutes())}`);
      }
      let diffMinutes = Math.ceil((time.getTime() - Date.now()) / 1000 / 60);
      let hours = Math.floor(diffMinutes / 60);
      let minutes = diffMinutes - hours * 60;
      return (
        on ? LocalizedString.countdownTipOff : LocalizedString.countdownTipOn
      )(hours, minutes);
    }
    let _ = this.timers || [];
    let on = this.state.on;
    let now = new Date();
    let timingScenes = _.filter((item) => {
      return (
        item.setting.enable_timer === "1" &&
        item.setting.timer_type !== "1" &&
        item.status === 0
      );
    })
      .map((item) => {
        return {
          timer: item,
          sceneID: item.sceneID,
          time: formatTimerTime(item.setting[on ? "off_time" : "on_time"]),
        };
      })
      .filter((item) => {
        return item.time > now;
      });

    let hasTiming = timingScenes.length > 0;

    let countdownScenes = _.filter((item) => {
      // 通过timer_type===1，过滤倒计时
      if (
        item.setting.enable_timer === "1" &&
        item.setting.timer_type === "1" &&
        item.status === 0 &&
        ((item.setting.enable_timer_off === "1" && on) ||
          (item.setting.enable_timer_on === "1" && !on))
      ) {
        return true;
      } else {
        return false;
      }
    })
      .map((item) => {
        return {
          timer: item,
          sceneID: item.sceneID,
          time: formatTimerTime(item.setting[on ? "off_time" : "on_time"]),
        };
      })
      .filter((item) => {
        return item.time > now;
      });

    let hasCountdown = countdownScenes.length > 0;

    if (hasCountdown) {
      let recentTimer = countdownScenes.sort((a, b) => {
        return a.time > b.time ? 1 : -1;
      })[0];
      this.firstCountdownTimer = recentTimer;
    } else {
      this.firstCountdownTimer = null;
    }

    let lastScene =
      !hasTiming && !hasCountdown
        ? null
        : [...timingScenes, ...countdownScenes].sort((a, b) => {
            return a.time > b.time ? 1 : -1;
          })[0];

    let timerInfo = !lastScene ? "" : getTimerInfo(lastScene, on);
    this.setState({
      timingActive: hasTiming,
      countdownActive: hasCountdown,
      timerInfo,
    });
  };

  setTiming = () => {
    if (!this.SwitchBaseProps) {
      return;
    }
    let switchOnProps = Object.assign({}, this.SwitchBaseProps, {
      value: true,
      did: DeviceID,
    });
    let switchOffProps = Object.assign({}, this.SwitchBaseProps, {
      value: false,
      did: DeviceID,
    });
    Host.ui.openTimerSettingPageWithVariousTypeParams(
      "set_properties",
      [switchOnProps],
      "set_properties",
      [switchOffProps]
    );
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

    if (!this.loop) {
      console.log("开始轮询！", this.getDeviceProps);
      this.loop = setInterval(() => {
        this.getDeviceProps();
      }, 1000);
    }
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
    // 从其他rn页面返回
    this.viewFocusListener && this.viewFocusListener.remove();
    this.viewFocusListener = this.props.navigation.addListener(
      "didFocus",
      (_) => {
        this.getDeviceProps(this.getTimerList);
      }
    );

    // 从原生页面返回
    this.viewAppearListener && this.viewAppearListener.remove();
    this.viewAppearListener = PackageEvent.packageViewWillAppear.addListener(
      (_) => {
        this.getDeviceProps(this.getTimerList);
      }
    );

    getInstanceFromCache(this.updateInstance);
    getInstanceFromNet(this.updateInstance);

    this.firmwareChange = DeviceEventEmitter.addListener(
      "MH_FirmwareNeedUpdateAlert",
      (params) => {
        if (params && params.needUpgrade) {
          this.props.navigation.setParams({
            showDot: true,
          });
        }
      }
    );
    setTimeout(() => {
      this.setState({
        isOnline: Device.isOnline,
      });
    }, 10);
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

  render() {
    let {
      on,
      timerInfo,
      supportBrightness,
      supportTemperature,
      brightness,
      brightnessMax,
      brightnessMin,
      temperature,
      temperatureMax,
      temperatureMin,
      showDialog,
      dialogTimeout,
      dialogTitle,
      status,
    } = this.state;
    let deviceTitle =
      timerInfo ||
      (on ? LocalizedString.powerOn() : LocalizedString.powerOff());

    // 如果不支持亮度调节，则修正数值
    if (!supportBrightness) {
      brightness = undefined;
      brightnessMin = undefined;
      brightnessMax = undefined;
    }
    // 如果不支持色温调节，则修正数值
    if (!supportTemperature) {
      temperature = undefined;
      temperatureMin = undefined;
      temperatureMax = undefined;
    }

    let styleBgExtra =
      on && supportBrightness
        ? `'hsl(236, 84%, ${
            getPercent(brightness, brightnessMin, brightnessMax, 0.6, 0.65) *
            100
          }%)'`
        : "#5B64F1";
    let deviceProps = {
      on,
      disabled: !!this.isHandling,
      brightness,
      brightnessMin,
      brightnessMax,
      temperature,
      temperatureMin,
      temperatureMax,
    };
    const isSwitchOn = status[SwitchKey] && status[SwitchKey].value;
    const isDefaultPowerOnStateKeyOn =
      status[defaultPowerOnStateKey] &&
      status[defaultPowerOnStateKey].value === 1;
    const isIndicatorLightOn =
      status[indicatorLightKey] && status[indicatorLightKey].value === true;
    const PowerButton = TitledImageButton(
      ImageButton(() => (
        <View>
          <Image
            source={isSwitchOn ? power_on : power_off}
            style={Styles.buttonImage}
          />
        </View>
      ))
    );
    const IndicatorLightButton = TitledImageButton(
      ImageButton(() => (
        <View>
          <Image
            source={isIndicatorLightOn ? light_on : light_off}
            style={Styles.buttonImage}
          />
        </View>
      ))
    );
    return (
      <Animated.View style={[Styles.container]}>
        <View style={Styles.bg}>
          <Image style={Styles.bgImage} source={isSwitchOn ? bgOn : bgOff} />
        </View>

        <SafeAreaView style={Styles.safearea}>
          <Navigator navigation={this.props.navigation} />
          <View style={Styles.containerInner}>
            <Text style={Styles.currentText1}>
              {isSwitchOn ? "开启" : "关闭"}
            </Text>
            <Text style={Styles.currentText2}>当前电源</Text>
            <View style={Styles.status}>
              <View style={Styles.status1}>
                <Text style={Styles.currentText3}>
                  {isDefaultPowerOnStateKeyOn ? "记忆" : "关闭"}
                </Text>
                <Text style={Styles.currentText4}>上电状态</Text>
              </View>
              <View style={Styles.line}></View>
              <View style={Styles.status2}>
                <Text style={Styles.currentText3}>
                  {status[indicatorLightKey] && status[indicatorLightKey].value
                    ? "开启"
                    : "关闭"}
                </Text>
                <Text style={Styles.currentText4}>氛围灯</Text>
              </View>
            </View>
            <View
              style={Styles.switch}
              onTouchStart={() => this.control({ [SwitchKey]: !isSwitchOn })}
            >
              <PowerButton
                on={isSwitchOn}
                disabled={!!this.isHandling}
                title={"开关"}
                direction="row"
                // onPress={() => this.control({ [SwitchKey]: !isSwitchOn })}
              />
            </View>
            {/* <View style={Styles.indicatorLight}>
              <IndicatorLightButton
                on={isIndicatorLightOn}
                disabled={true}
                title={"氛围灯"}
                direction="row"
              />
              <View
                style={{
                  marginLeft: "auto",
                  height: adjustSize(25),
                  marginTop: adjustSize(7.5),
                }}
              >
                <Switch
                  style={{
                    width: adjustSize(50),
                    height: adjustSize(25),
                  }}
                  onTintColor="rgb(50,189,192)"
                  tintColor="rgb(229,229,229)"
                  value={isIndicatorLightOn}
                  onValueChange={(value) =>
                    this.control({ [indicatorLightKey]: !!value })
                  }
                />
              </View>
            </View> */}
          </View>
        </SafeAreaView>

        <LoadingDialog
          visible={showDialog}
          message={dialogTitle}
          timeout={dialogTimeout}
        />
      </Animated.View>
    );
  }
}

const Styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-evenly",
    alignItems: "center",
  },

  bg: {
    position: "absolute",
    zIndex: 0,
  },

  bgImage: {
    height: adjustSize(400),
    width: adjustSize(360),
  },
  buttonImage: { width: adjustSize(40), height: adjustSize(40) },
  currentText1: {
    fontSize: adjustSize(36),
    color: "#000000",
  },
  currentText2: {
    marginTop: adjustSize(4),
    opacity: 0.6,
    fontSize: adjustSize(12),
    color: "#000000",
  },
  currentText3: { fontSize: adjustSize(28), color: "#000000", opacity: 0.8 },
  currentText4: { fontSize: adjustSize(12), color: "#000000", opacity: 0.6 },
  status: {
    marginTop: adjustSize(24),
    height: adjustSize(80),
    display: "flex",
    flexDirection: "row",
    position: "relative",
    textAlign: "center",
  },
  status1: {
    justifyContent: "center",
    alignItems: "center",
    width: "50%",
  },
  line: {
    position: "absolute",
    width: adjustSize(1),
    height: adjustSize(40),
    left: "50%",
    marginLeft: adjustSize(-0.5),
    backgroundColor: "rgba(229,229,229,1)",
    top: adjustSize(20),
  },
  status2: {
    justifyContent: "center",
    alignItems: "center",
    width: "50%",
  },
  switch: {
    display: "flex",
    backgroundColor: "#fff",
    flexDirection: "row",
    width: "100%",
    borderRadius: adjustSize(12),
  },
  indicatorLight: {
    display: "flex",
    backgroundColor: "#fff",
    flexDirection: "row",
    height: adjustSize(80),
    width: "100%",
    padding: adjustSize(20),
    borderRadius: adjustSize(12),
    marginTop: adjustSize(12),
  },
  safearea: {
    flex: 1,
    width: "100%",
  },
  containerInner: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    paddingTop: adjustSize(80),
    marginTop: 0,
    marginBottom: adjustSize(40),
    paddingLeft: adjustSize(12),
    paddingRight: adjustSize(12),
  },
  main: {
    flex: 1,
    zIndex: 10,
  },
  sliders: {
    marginTop: adjustSize(-15),
    marginBottom: adjustSize(30),
  },
  sliderWrap: {
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    marginTop: adjustSize(29),
  },
  sliderIconWrap: {
    width: adjustSize(60),
    alignItems: "flex-end",
  },
  sliderIcon: {
    width: adjustSize(20),
    height: adjustSize(20),
  },
  slider: {
    width: adjustSize(203),
    height: adjustSize(21),
    // backgroundColor: '#f00',
    marginHorizontal: adjustSize(5),
  },
  sliderText: {
    width: adjustSize(60),
    fontSize: adjustSize(12),
    color: "#ddd",
    fontFamily: "MI-LANTING--GBK1-Light",
  },
  sliderTextOn: {
    color: "#fff",
  },
  sliderTextOff: {
    color: "#ddd",
  },
});
