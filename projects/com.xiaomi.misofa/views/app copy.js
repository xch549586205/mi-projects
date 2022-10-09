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
  DeviceEventEmitter
} from "react-native";
import { SafeAreaView } from "react-navigation";
import { Device, Service, DeviceEvent, PackageEvent, Host } from "miot";
import { LoadingDialog } from "miot/ui";

import getPercent from "../modules/getPercent";
import Navigator from "../modules/navigator";
import {
  LocalizedString,
  NOOP,
  PROTOCOLCACHEKEY,
  DeviceID,
  SwitchKey,
  StatusKey, ModeKey,
  targetKey,
  currentKey,
  adjustSize,
  getDefinitionWithKeyFromInstance,
  getInstanceFromCache,
  getInstanceFromNet,
  formatTimerTime,
  fixNum
} from "../modules/consts";

import Protocol from "../modules/protocol";

import DeviceButton from "../components/device";
import TimingImage from "../components/timing";
import SwitchImage from "../components/switch";
import CountdownImage from "../components/countdown";
import ImageButton from "../components/imageButton";
import TitledImageButton from "../components/titledImageButton";

import currentBg from "./app/current.png";
import startOn from "./app/startOn.png";
import startOff from "./app/startOff.png";
import pauseOn from "./app/pauseOn.png";
import pauseOff from "./app/pauseOff.png";


const window = Dimensions.get("window");
const isIphoneX =
  Platform.OS === "ios" && window.width === 375 && window.height === 812;

// const DeviceButton = ImageButton(DeviceImage);
const TitledTiming = TitledImageButton(ImageButton(TimingImage));
const TitledSwitch = TitledImageButton(ImageButton(SwitchImage));
const TitledCountdown = TitledImageButton(ImageButton(CountdownImage));

const params = [
  SwitchKey,
  StatusKey, ModeKey,
  targetKey,
  currentKey
];

function getIconSource(type, on) {
  switch (true) {
    case type === "brightness" && on:
      return require("./app/brightness-on.png");
    case type === "brightness" && !on:
      return require("./app/brightness-off.png");
    case type === "temperature" && on:
      return require("./app/temperature-on.png");
    case type === "temperature" && !on:
      return require("./app/temperature-off.png");
    default:
      return null;
  }
}

export default class App extends Component {
  constructor(props) {
    super(props);
    this.initProtocol();
  }
  paramInfos = {}
  state = {
    paramInfos: {},
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
    status: {}
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
          .catch((_) => { });
      })
      .catch((_) => { });
  };


  switchProp = "";

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
        dialogTitle: ""
      });
    }, 300);
  };

  showFailTips = (tip) => {
    this.setState({
      showDialog: true,
      dialogTimeout: 300,
      dialogTitle: tip
    });
    this.timerTips && clearTimeout(this.timerTips);
    this.timerTips = setTimeout(() => {
      this.dismissTips();
    }, 300);
  };

  setHandling = (start, end) => {
    this.isHandling = true;
    this.stateAnimation && this.stateAnimation.stop();
    this.stateAnimation = Animated.timing(this.state.containerBackgroundColor, {
      toValue: end,
      duration: 300
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
      duration: 1000
    });
    this.stateAnimation.start(() => {
      this.isHandling = false;
      this.setState({
        on,
        isHandling: false
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
      on
    });
    this.updateTimerState();
    this.updateNavigationState();
    this.stateAnimation && this.stateAnimation.stop();
    this.stateAnimation = Animated.timing(this.state.containerBackgroundColor, {
      toValue: on ? 1 : 0,
      duration: 1000
    });
    this.stateAnimation.start();
  };

  switch = () => {
    // 防止高频提交
    if (this.isHandling) {
      return;
    }
    this.setState({
      isHandling: true
    });
    let on = !this.state.paramInfos["on"].value;
    let switchProps = Object.assign({
      siid: this.state.paramInfos["on"].siid,
      piid: this.state.paramInfos["on"].piid,
      value: on
    });
    this.setHandling(on ? 0 : 0.5, on ? 0.5 : 1);
    // this.showLoadingTips(LocalizedString.handling());
    Service.spec
      .setPropertiesValue([Object.assign({ did: DeviceID }, switchProps)])
      .then((_) => {
        console.log(_);
        let code = _[0].code;
        // 1表示处理中，这里不处理，等消息推送
        if (code === 1) {
          return;
        }
        if (code === 0) {
          this.dismissTips();
          this.setHandled(on);
          return;
        }
        this.setHandled(!on);
        this.showFailTips(LocalizedString.failed());
      })
      .catch((_) => {
        console.log(_);
        this.setHandled(!on);
        this.showFailTips(LocalizedString.failed());
      });
  };

  getDeviceProps = (cb) => {
    if (!this.SwitchBaseProps) {
      return;
    }
    let propertys = [];
    for (const key in this.state.paramInfos) {
      propertys.push(Object.assign({ did: DeviceID }, { siid: this.state.paramInfos[key].siid, piid: this.state.paramInfos[key].piid }));
    }
    Service.spec
      .getPropertiesValue(propertys)
      .then((res) => {
        let paramInfos = this.formatDeviceProps(res);
        this.setState({
          paramInfos
        }, () => {
          if (typeof cb === "function") {
            cb(res);
          }
        });

      })
      .catch((_) => { });
  };

  formatDeviceProps = (values) => {
    const paramInfos = { ...this.state.paramInfos };
    for (let value of values) {
      if (value.code !== 0) {
        continue;
      }
      let siid = value.siid,
        piid = value.piid;
      for (const key in paramInfos) {
        if (paramInfos[key].siid === siid && paramInfos[key].piid === piid) {
          paramInfos[key] = { ...paramInfos[key], ...value };
        }
      }
    }
    return paramInfos;
  };

  updateNavigationState = () => {
    this.props.navigation.setParams({
      barColor: this.state.on ? "white" : "black"
    });
  };

  getTimerList = () => {
    Service.scene
      .loadTimerScenes(DeviceID, {
        identify: DeviceID
      })
      .then((_) => {
        this.timers = _;
        this.startUpdateTimerState();
      })
      .catch((_) => { });
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
        )(`${ fixNum(time.getHours()) }:${ fixNum(time.getMinutes()) }`);
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
          time: formatTimerTime(item.setting[on ? "off_time" : "on_time"])
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
          time: formatTimerTime(item.setting[on ? "off_time" : "on_time"])
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
      timerInfo
    });
  };

  setTiming = () => {
    if (!this.SwitchBaseProps) {
      return;
    }
    let switchOnProps = Object.assign({}, this.SwitchBaseProps, {
      value: true,
      did: DeviceID
    });
    let switchOffProps = Object.assign({}, this.SwitchBaseProps, {
      value: false,
      did: DeviceID
    });
    Host.ui.openTimerSettingPageWithVariousTypeParams(
      "set_properties",
      [switchOnProps],
      "set_properties",
      [switchOffProps]
    );
  };

  setCountdown = () => {
    if (!this.SwitchBaseProps) {
      return;
    }
    let now = new Date();
    let firstCountdownTimer = this.firstCountdownTimer;
    let firstCountdownTime =
      this.firstCountdownTimer && this.firstCountdownTimer.time > now
        ? this.firstCountdownTimer.time
        : now;
    let onParam = Object.assign({}, this.SwitchBaseProps, {
      value: true,
      did: DeviceID
    });
    let offParam = Object.assign({}, this.SwitchBaseProps, {
      value: false,
      did: DeviceID
    });
    Service.scene.openCountDownPage(!!this.state.on, {
      onMethod: "set_properties",
      onParam: [onParam],
      offMethod: "set_properties",
      offParam: [offParam]
    });
  };

  // 修改亮度值，用以更新ui，不调接口
  changeBrightness = (value) => {
    if (!Number.isInteger(value)) {
      return;
    }
    this.rafBrightness && cancelAnimationFrame(this.rafBrightness);
    this.rafBrightness = requestAnimationFrame(() => {
      this.setState({
        brightness: value
      });
    });
  };

  // 设置亮度值，调接口
  setBrightness = (value) => {
    if (value === this.lastModifiedBrightness) {
      return;
    }
    if (!this.BrightnessBaseProps) {
      return;
    }
    let brightnessProps = Object.assign({}, this.BrightnessBaseProps, {
      value: value
    });
    this.showLoadingTips(LocalizedString.handling());
    Service.spec
      .setPropertiesValue([Object.assign({ did: DeviceID }, brightnessProps)])
      .then((_) => {
        let code = _[0].code;
        if (code === 1) {
          return;
        }
        if (code === 0) {
          this.lastModifiedBrightness = value;
          // 设置后，会自动启动设备
          // this.changeState(true);
          this.dismissTips();
          return;
        }
        this.showFailTips(LocalizedString.failed());
      })
      .catch((_) => {
        this.showFailTips(LocalizedString.failed());
      });
  };

  // 修改色温值，用以更新ui，不调接口
  changeTemperature = (value) => {
    if (!Number.isInteger(value)) {
      return;
    }
    this.rafTemperature && cancelAnimationFrame(this.rafTemperature);
    this.rafTemperature = requestAnimationFrame(() => {
      this.setState({
        temperature: value
      });
    });
  };

  // 设置色温值，调接口
  setTemperature = (value) => {
    if (value === this.lastModifiedTemperature) {
      return;
    }
    if (!this.TemperatureBaseProps) {
      return;
    }
    let temperatureProps = Object.assign({}, this.TemperatureBaseProps, {
      value: value
    });
    this.showLoadingTips(LocalizedString.handling());
    Service.spec
      .setPropertiesValue([Object.assign({ did: DeviceID }, temperatureProps)])
      .then((_) => {
        let code = _[0].code;
        if (code === 1) {
          return;
        }
        if (code === 0) {
          this.lastModifiedTemperature = value;
          // 设置后，会自动启动设备
          // this.changeState(true);
          this.dismissTips();
          return;
        }
        this.showFailTips(LocalizedString.failed());
      })
      .catch((_) => {
        this.showFailTips(LocalizedString.failed());
      });
  };

  updateInstance = (instance) => {
    if (!instance) {
      return;
    }
    let supports = {};
    let supportCount = 0;
    let paramInfos = getDefinitionWithKeyFromInstance(
      instance,
      params
    );
    this.setState({
      paramInfos
    });
    let switchDef = paramInfos[SwitchKey];
    if (switchDef) {
      this.switchProp = `prop.${ switchDef.siid }.${ switchDef.piid }`;
      this.SwitchBaseProps = {
        siid: switchDef.siid,
        piid: switchDef.piid
      };
    }
    if (supportCount) {
      this.setState(supports);
    }
    this.initPropsSubscription();
    this.getDeviceProps(this.getTimerList);
  };

  initPropsSubscription = () => {
    // 状态订阅
    let props = [];
    if (this.switchProp) {
      props.push(this.switchProp);
    }
    if (this.brightnessProp) {
      props.push(this.brightnessProp);
    }
    if (this.temperatureProp) {
      props.push(this.temperatureProp);
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
    console.log(message, "message");
    if (!message) {
      return;
    }
    this.handleReceivedSwitchMessage(message);
    this.handleReceivedBrightnessMessage(message);
    this.handleReceivedTemperatureMessage(message);
  };

  handleReceivedSwitchMessage = (message) => {
    if (!message.has(this.switchProp)) {
      return;
    }
    let value = message.get(this.switchProp);
    if (Array.isArray(value)) {
      value = value[0];
    }
    if (typeof value === "undefined") {
      return;
    }
    // this.changeState(value);
    this.setHandled(value);
  };

  handleReceivedBrightnessMessage = (message) => {
    if (!message.has(this.brightnessProp)) {
      return;
    }
    let value = message.get(this.brightnessProp);
    if (Array.isArray(value)) {
      value = value[0];
    }
    if (typeof value === "undefined") {
      return;
    }
    this.changeBrightness(value);
  };

  handleReceivedTemperatureMessage = (message) => {
    if (!message.has(this.temperatureProp)) {
      return;
    }
    let value = message.get(this.temperatureProp);
    if (Array.isArray(value)) {
      value = value[0];
    }
    if (typeof value === "undefined") {
      return;
    }
    this.changeTemperature(value);
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
            showDot: true
          });
        }
      }
    );
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
      timingTitle,
      timingActive,
      countdownTitle,
      countdownActive,
      switchTitle,
      containerBackgroundColor,
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
      status, mode
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
        ? `'hsl(236, 84%, ${ getPercent(brightness, brightnessMin, brightnessMax, 0.6, 0.65) *
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
      temperatureMax
    };
    let sliderTextExtra = on ? Styles.sliderTextOn : Styles.sliderTextOff;
    return (
      <Animated.View
        style={[
          Styles.container
        ]}
      >
        <SafeAreaView style={Styles.safearea}>
          <Navigator navigation={this.props.navigation} />
          <View style={Styles.containerInner}>
            <View style={Styles.main}>
              {/* <DeviceButton
                {...deviceProps}
                title={deviceTitle}
                onPress={this.switch}
              /> */}
              <View style={Styles.current}>
                <View style={Styles.currentLeft}>
                  <Text style={Styles.currentWord}>
                    当前行程
                  </Text>
                  <Text style={Styles.currentRate}>
                    60 <Text style={Styles.unit}>%</Text>
                  </Text>
                </View>
                <View style={Styles.currentRight}>
                  <Image
                    style={Styles.currentImg}
                    source={currentBg}
                  />
                </View>
              </View>
              <View style={Styles.startAndPause}>
                <View>
                  <Text style={this.state.paramInfos["on"] && this.state.paramInfos["on"].value ? Styles.currentStart : Styles.currentPause}>启动</Text>
                </View>
                <View>
                  <Text style={!(this.state.paramInfos["on"] && this.state.paramInfos["on"].value) ? Styles.currentStart : Styles.currentPause}>暂停</Text>
                </View>
              </View>

              {/* {supportBrightness || supportTemperature ? (
                <View style={Styles.sliders}>
                  {supportBrightness ? (
                    <View style={Styles.sliderWrap}>
                      <View style={Styles.sliderIconWrap}>
                        <Image
                          style={Styles.sliderIcon}
                          source={getIconSource("brightness", on)}
                        />
                      </View>
                      <Slider
                        style={Styles.slider}
                        step={1}
                        value={brightness}
                        maximumValue={brightnessMax}
                        minimumValue={brightnessMin}
                        maximumTrackTintColor="rgba(0, 0, 0, 0.1)"
                        minimumTrackTintColor="#23BFFF"
                        thumbTintColor="#fff"
                        onValueChange={this.changeBrightness}
                        onSlidingComplete={this.setBrightness}
                      />
                      <Text style={[Styles.sliderText, sliderTextExtra]}>
                        {brightness}%
                      </Text>
                    </View>
                  ) : null}
                  {supportTemperature ? (
                    <View style={Styles.sliderWrap}>
                      <View style={Styles.sliderIconWrap}>
                        <Image
                          style={Styles.sliderIcon}
                          source={getIconSource("temperature", on)}
                        />
                      </View>
                      <Slider
                        style={Styles.slider}
                        step={1}
                        value={temperature}
                        maximumValue={temperatureMax}
                        minimumValue={temperatureMin}
                        maximumTrackTintColor="rgba(0, 0, 0, 0.1)"
                        minimumTrackTintColor="#ffdc9d"
                        thumbTintColor="#fff"
                        onValueChange={this.changeTemperature}
                        onSlidingComplete={this.setTemperature}
                      />
                      <Text style={[Styles.sliderText, sliderTextExtra]}>
                        {temperature}K
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null} */}
            </View>
            <View
              style={[
                Styles.buttons,
                Device.isOwner
                  ? null
                  : {
                    justifyContent: "center"
                  }
              ]}
            >
              {Device.isOwner ? (
                <TitledTiming
                  on={on}
                  disabled={!!this.isHandling}
                  active={timingActive}
                  title={timingTitle}
                  onPress={this.setTiming}
                />
              ) : null}
              <TitledSwitch
                on={on}
                disabled={!!this.isHandling}
                title={switchTitle}
                onPress={this.switch}
              />
              {Device.isOwner ? (
                <TitledCountdown
                  on={on}
                  disabled={!!this.isHandling}
                  active={countdownActive}
                  title={countdownTitle}
                  onPress={this.setCountdown}
                />
              ) : null}
            </View>
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
    alignItems: "center"
  },
  safearea: {
    flex: 1,
    width: "100%"
  },
  containerInner: {
    flex: 1,
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 0,
    marginBottom: adjustSize(40)
  },
  main: {
    flex: 1
  },
  sliders: {
    marginTop: adjustSize(-15),
    marginBottom: adjustSize(30)
  },
  sliderWrap: {
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    marginTop: adjustSize(29)
  },
  sliderIconWrap: {
    width: adjustSize(60),
    alignItems: "flex-end"
  },
  sliderIcon: {
    width: adjustSize(20),
    height: adjustSize(20)
  },
  slider: {
    width: adjustSize(203),
    height: adjustSize(21),
    // backgroundColor: '#f00',
    marginHorizontal: adjustSize(5)
  },
  sliderText: {
    width: adjustSize(60),
    fontSize: adjustSize(12),
    color: "#ddd",
    fontFamily: "MI-LANTING--GBK1-Light"
  },
  sliderTextOn: {
    color: "#fff"
  },
  sliderTextOff: {
    color: "#ddd"
  },
  buttons: {
    width: adjustSize(321),
    flexDirection: "row",
    justifyContent: "space-between"
  },
  current: {
    display: "flex",
    flexDirection: "row"
  },
  currentImg: {
    width: adjustSize(160),
    height: adjustSize(120)
  },
  currentLeft: {
    width: "50%", textAlign: "center", justifyContent: "center",
    alignItems: "center"
  },
  currentRight: {
    width: "50%"
  },
  startAndPause: {
    display: "flex",
    flexDirection: "row"
  },
  currentStart: {
    color: "#ff0000"
  },
  currentPause: {
    color: "#000000"
  }
});
