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
import { Device, Service, DeviceEvent, PackageEvent, Host } from "miot";
import { LoadingDialog } from "miot/ui";
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

import currentBg from "./app/current.png";
import startOn from "./app/startOn.png";
import startOff from "./app/startOff.png";
import pauseOn from "./app/pauseOn.png";
import pauseOff from "./app/pauseOff.png";
import lie_sel from "./app/lie_sel.png";
import lie_unsel from "./app/lie_unsel.png";
import Movie_sel from "./app/Movie_sel.png";
import Movie_unsel from "./app/Movie_unsel.png";
import music_sel from "./app/music_sel.png";
import music_unsel from "./app/music_unsel.png";
import read_sel from "./app/read_sel.png";
import read_unsel from "./app/read_unsel.png";
import sit_sel from "./app/sit_sel.png";
import sit_unsel from "./app/sit_unsel.png";
import network_sel from "./app/network_sel.png";
import network_unsel from "./app/network_unsel.png";

const { width } = Dimensions.get("screen");

const window = Dimensions.get("window");
const isIphoneX =
  Platform.OS === "ios" && window.width === 375 && window.height === 812;

// const DeviceButton = ImageButton(DeviceImage);
const TitledTiming = TitledImageButton(ImageButton(TimingImage));
const TitledSwitch = TitledImageButton(ImageButton(SwitchImage));
const TitledCountdown = TitledImageButton(ImageButton(CountdownImage));

const params = [rangeKey, SwitchKey, defaultPowerOnStateKey];

export default class App extends Component {
  constructor(props) {
    super(props);
    this.initProtocol();
  }
  paramInfos = {};
  getting = false;
  loop = null;
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
    console.log(controlParams, "发送控制命令参数-------------");
    Service.spec
      .setPropertiesValue([Object.assign({ did: DeviceID }, controlParams)])
      .then((res) => {
        let code = res[0].code;
        this.setState({
          isHandling: false,
        });
        // 1表示处理中，这里不处理，等消息推送
        if (code === 1) {
          return;
        }
        if (code === 0) {
          console.log(res, "控制命令成功结果-------------");
          newStatus[cmdParam].value = cmdValue;
          this.setState({ status: newStatus });
          this.dismissTips();
          this.getDeviceProps();
          return;
        }
        console.log(res, "控制命令失败结果-------------");
        this.showFailTips(LocalizedString.failed());
      })
      .catch((error) => {
        this.setState({
          isHandling: false,
        });
        console.log(error, "控制命令失败结果-------------");
        this.showFailTips(LocalizedString.failed());
      })
      .finally(() => {
        this.setState({
          isHandling: false,
        });
      });
  };

  switch = (on) => {
    this.control({ on });
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
        let status = this.formatDeviceProps(res);
        console.log(status, "查询状态成功-------------");
        if (JSON.stringify(status) !== JSON.stringify(this.state.status)) {
          this.setState({
            status,
          });
        }
        if (typeof cb === "function") {
          cb(res);
        }
      })
      .catch((error) => {
        console.log(error, "查询状态失败-------------");
      })
      .finally(() => {
        this.getting = true;
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
      if (value) {
        // 当当前行程发生变化、目前行程与之同步
        if (
          param.siid === 4 &&
          param.piid === 2 &&
          value[0] !== this.state.status["target-trip"].value
        ) {
          // this.control({ "target-trip": value[0] });
          newStatus["target-trip"].value = value[0];
        }
        newStatus[key].value = value[0];
        console.info(param, value, "-------------状态有新的变化");
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
    const isOn = status["on"] && status["on"].value;

    const StartButton = TitledImageButton(
      ImageButton(() => (
        <View>
          <Image
            source={isOn ? startOn : startOff}
            style={isOn ? Styles.currentStartImage : Styles.currentPauseImage}
          />
        </View>
      ))
    );
    const PauseButton = TitledImageButton(
      ImageButton(() => (
        <View>
          <Image
            source={!isOn ? pauseOn : pauseOff}
            style={!isOn ? Styles.currentStartImage : Styles.currentPauseImage}
          />
        </View>
      ))
    );
    const DefaultOnButton = TitledImageButton(
      ImageButton(() => (
        <View>
          <Image
            source={
              status["default-power-on-state"] &&
              status["default-power-on-state"].value === 1
                ? startOn
                : startOff
            }
            style={
              status["default-power-on-state"] &&
              status["default-power-on-state"].value === 1
                ? Styles.currentStartImage
                : Styles.currentPauseImage
            }
          />
        </View>
      ))
    );
    const DefaultOffButton = TitledImageButton(
      ImageButton(() => (
        <View>
          <Image
            source={
              status["default-power-on-state"] &&
              status["default-power-on-state"].value === 0
                ? pauseOn
                : pauseOff
            }
            style={
              status["default-power-on-state"] &&
              status["default-power-on-state"].value === 0
                ? Styles.currentStartImage
                : Styles.currentPauseImage
            }
          />
        </View>
      ))
    );
    const RangeButton10 = TitledImageButton(
      ImageButton(({ title }) => (
        <View>
          <Image
            source={
              status["range"] && status["range"].value === 10
                ? pauseOn
                : pauseOff
            }
            style={
              status["range"] && status["range"].value === 10
                ? Styles.currentStartImage
                : Styles.currentPauseImage
            }
          />
        </View>
      ))
    );
    const RangeButton30 = TitledImageButton(
      ImageButton(({ title }) => (
        <View>
          <Image
            source={
              status["range"] && status["range"].value === 30
                ? pauseOn
                : pauseOff
            }
            style={
              status["range"] && status["range"].value === 30
                ? Styles.currentStartImage
                : Styles.currentPauseImage
            }
          />
        </View>
      ))
    );
    const RangeButton35 = TitledImageButton(
      ImageButton(({ title }) => (
        <View>
          <Image
            source={
              status["range"] && status["range"].value === 35
                ? pauseOn
                : pauseOff
            }
            style={
              status["range"] && status["range"].value === 35
                ? Styles.currentStartImage
                : Styles.currentPauseImage
            }
          />
        </View>
      ))
    );
    const RangeButton20 = TitledImageButton(
      ImageButton(({ title }) => (
        <View>
          <Image
            source={
              status["range"] && status["range"].value === 20
                ? pauseOn
                : pauseOff
            }
            style={
              status["range"] && status["range"].value === 20
                ? Styles.currentStartImage
                : Styles.currentPauseImage
            }
          />
        </View>
      ))
    );
    const RangeButton25 = TitledImageButton(
      ImageButton(({ title }) => (
        <View>
          <Image
            source={
              status["range"] && status["range"].value === 25
                ? pauseOn
                : pauseOff
            }
            style={
              status["range"] && status["range"].value === 25
                ? Styles.currentStartImage
                : Styles.currentPauseImage
            }
          />
        </View>
      ))
    );
    console.log(status, "status");
    return (
      <Animated.View style={[Styles.container]}>
        <SafeAreaView style={Styles.safearea}>
          <Navigator navigation={this.props.navigation} />
          <View style={Styles.containerInner}>
            <View style={Styles.main}>
              <Text>开关</Text>
              <View style={Styles.startAndPause}>
                <View
                  style={
                    isOn
                      ? Styles.startAndPause_isStart
                      : Styles.startAndPause_isPause
                  }
                >
                  <StartButton
                    on={isOn}
                    disabled={!!this.isHandling}
                    title={PluginStrings.on}
                    direction="row"
                    onPress={() => this.switch(true)}
                  />
                </View>
                <View style={Styles.startAndPause_line}></View>
                <View
                  style={
                    !isOn
                      ? Styles.startAndPause_isStart
                      : Styles.startAndPause_isPause
                  }
                >
                  <PauseButton
                    on={!isOn}
                    disabled={!!this.isHandling}
                    title={PluginStrings.off}
                    direction="row"
                    onPress={() => this.switch(false)}
                  />
                </View>
              </View>

              <Text>默认上电状态 </Text>
              <View style={Styles.startAndPause}>
                <View
                  style={
                    !isOn
                      ? Styles.startAndPause_isStart
                      : Styles.startAndPause_isPause
                  }
                >
                  <DefaultOnButton
                    on={
                      status["default-power-on-state"] &&
                      status["default-power-on-state"].value === 1
                    }
                    disabled={!!this.isHandling}
                    title={"记忆"}
                    direction="row"
                    onPress={() =>
                      this.control({ "default-power-on-state": 1 })
                    }
                  />
                </View>
                <View style={Styles.startAndPause_line}></View>

                <View
                  style={
                    isOn
                      ? Styles.startAndPause_isStart
                      : Styles.startAndPause_isPause
                  }
                >
                  <DefaultOffButton
                    on={
                      status["default-power-on-state"] &&
                      status["default-power-on-state"].value === 0
                    }
                    disabled={!!this.isHandling}
                    title={"关闭"}
                    direction="row"
                    onPress={() =>
                      this.control({ "default-power-on-state": 0 })
                    }
                  />
                </View>
              </View>

              <Text>距离 </Text>
              <View style={Styles.startAndPause}>
                <RangeButton10
                  on={status["range"] && status["range"].value === 10}
                  disabled={!!this.isHandling}
                  title={"10"}
                  direction="row"
                  onPress={() => this.control({ range: 10 })}
                />
                <RangeButton20
                  on={status["range"] && status["range"].value === 20}
                  disabled={!!this.isHandling}
                  title={"20"}
                  direction="row"
                  onPress={() => this.control({ range: 20 })}
                />
                <RangeButton25
                  on={status["range"] && status["range"].value === 25}
                  disabled={!!this.isHandling}
                  title={"25"}
                  direction="row"
                  onPress={() => this.control({ range: 25 })}
                />
                <RangeButton30
                  on={status["range"] && status["range"].value === 30}
                  disabled={!!this.isHandling}
                  title={"30"}
                  direction="row"
                  onPress={() => this.control({ range: 30 })}
                />
                <RangeButton35
                  on={status["range"] && status["range"].value === 35}
                  disabled={!!this.isHandling}
                  title={"35"}
                  direction="row"
                  onPress={() => this.control({ range: 35 })}
                />
              </View>
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
    alignItems: "center",
  },
  safearea: {
    flex: 1,
    width: "100%",
  },
  containerInner: {
    flex: 1,
    width: "100%",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: adjustSize(32),
    marginTop: 0,
    marginBottom: adjustSize(40),
    paddingLeft: adjustSize(12),
    paddingRight: adjustSize(12),
  },
  main: {
    flex: 1,
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
  buttons: {
    width: adjustSize(321),
    flexDirection: "row",
    justifyContent: "space-between",
  },
  current: {
    display: "flex",
    flexDirection: "row",
  },
  currentWord: {
    color: "#000000",
    opacity: 0.6,
    fontSize: adjustSize(14),
  },
  currentRate: {
    color: "#000000",
    fontSize: adjustSize(50),
    marginTop: adjustSize(12),
  },
  unit: {
    fontSize: adjustSize(24),
  },
  currentImg: {
    width: adjustSize(160),
    height: adjustSize(120),
  },
  currentLeft: {
    paddingLeft: adjustSize(36),
    width: "50%",
    justifyContent: "center",
    // alignItems: "center"
  },
  currentRight: {
    width: "50%",
  },
  startAndPause: {
    marginTop: adjustSize(24),
    height: adjustSize(80),
    backgroundColor: "#ffffff",
    borderRadius: adjustSize(12),
    display: "flex",
    flexDirection: "row",
    position: "relative",
  },
  startAndPause_line: {
    position: "absolute",
    width: adjustSize(1),
    height: adjustSize(40),
    left: "50%",
    marginLeft: adjustSize(-0.5),
    backgroundColor: "rgba(229,229,229,1)",
    top: adjustSize(20),
  },
  startAndPause_isStart: {
    width: "50%",
    justifyContent: "center",
    alignItems: "center",
    fontSize: adjustSize(13),
    display: "flex",
    flexDirection: "row",
    color: "#999999",
  },
  startAndPause_isPause: {
    width: "50%",
    justifyContent: "center",
    alignItems: "center",
    fontSize: adjustSize(13),
    color: "#999999",
    display: "flex",
    flexDirection: "row",
  },
  currentStartText: {
    fontSize: adjustSize(13),
    color: "#999999",
    marginLeft: adjustSize(16),
  },
  currentPauseText: {
    fontSize: adjustSize(13),
    color: "#999999",
    marginLeft: adjustSize(16),
  },
  currentStartImage: {
    width: adjustSize(40),
    height: adjustSize(40),
  },
  currentPauseImage: {
    width: adjustSize(40),
    height: adjustSize(40),
  },
  modes: {
    width: "100%",
    marginTop: adjustSize(12),
    backgroundColor: "#ffffff",
    borderRadius: adjustSize(12),
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    paddingTop: adjustSize(8),
    paddingBottom: adjustSize(12),
    paddingLeft: adjustSize(10),
    paddingRight: adjustSize(10),
  },
  modeBtn: {
    marginTop: adjustSize(10),
    marginBottom: adjustSize(10),
    width: "33.333333%",
  },
  modeImage: {
    width: adjustSize(52),
    height: adjustSize(52),
  },
  target: {
    marginTop: adjustSize(12),
    backgroundColor: "#ffffff",
    paddingTop: adjustSize(18),
    paddingBottom: adjustSize(25),
    paddingLeft: adjustSize(20),
    paddingRight: adjustSize(20),
    borderRadius: adjustSize(12),
  },
  targetTitle: {
    display: "flex",
    flexDirection: "row",
    height: adjustSize(20),
    lineHeight: adjustSize(20),
    alignItems: "center",
  },
  targetText: {
    fontSize: adjustSize(14),
    color: "#000000",
  },
  targetValue: {
    color: "#000000",
    fontSize: adjustSize(12),
    opacity: 0.4,
  },
});
