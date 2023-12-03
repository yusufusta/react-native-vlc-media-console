import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
// @ts-ignore
import Video from "@lunarr/vlc-player";

import { useControlTimeout, useJSAnimations, usePanResponders } from './hooks';
import {
  Error,
  Loader,
  TopControls,
  BottomControls,
  PlayPause,
  Overlay,
} from './components';
import { PlatformSupport } from './OSSupport';
import { _onBack } from './utils';
import { _styles } from './styles';
import type { VideoPlayerProps, WithRequiredProperty } from './types';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import FastImage from 'react-native-fast-image';
import { useNavigation } from '@react-navigation/native';

const volumeWidth = 150;
const iconOffset = 0;

const AnimatedVideoPlayer = (
  props: WithRequiredProperty<VideoPlayerProps, 'animations'>,
) => {
  const {
    animations,
    toggleResizeModeOnFullscreen,
    doubleTapTime = 130,
    resizeMode = 'contain',
    isFullscreen = false,
    showOnStart = false,
    showOnEnd = false,
    alwaysShowControls = false,
    paused = false,
    muted = false,
    volume = 1,
    title = '',
    rate = 1,
    showDuration = false,
    showTimeRemaining = false,
    showHours = false,
    onSeek,
    onError,
    onBack,
    onEnd,
    onEnterFullscreen = () => { },
    onExitFullscreen = () => { },
    onHideControls = () => { },
    onShowControls = () => { },
    onPause,
    onPlay,
    onLoad,
    onLoadStart,
    onProgress,
    controlTimeoutDelay = 15000,
    tapAnywhereToPause = false,
    videoStyle = {},
    containerStyle = {},
    seekColor = '',
    source,
    disableBack = false,
    disableVolume = false,
    disableFullscreen = false,
    disableTimer = false,
    disableSeekbar = false,
    disablePlayPause = false,
    disableSeekButtons = false,
    disableOverlay,
    navigator,
    rewindTime = 15,
    pan: { horizontal: horizontalPan, inverted: invertedPan } = {},
    otherChannelList = [],
    streamUrlBuilder,
  } = props;

  const mounted = useRef(false);
  const _videoRef = useRef<Video>(null);
  const controlTimeout = useRef<ReturnType<typeof setTimeout>>(
    setTimeout(() => { }),
  ).current;
  const tapActionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [_resizeMode, setResizeMode] = useState(resizeMode);
  const [_paused, setPaused] = useState<boolean>(paused);
  const [_muted, setMuted] = useState<boolean>(muted);
  const [_volume, setVolume] = useState<number>(volume);
  const [_isFullscreen, setIsFullscreen] = useState<boolean>(
    isFullscreen || resizeMode === 'cover' || false,
  );
  const [_showTimeRemaining, setShowTimeRemaining] =
    useState<boolean>(showTimeRemaining);
  const [volumeTrackWidth, setVolumeTrackWidth] = useState<number>(0);
  const [volumeFillWidth, setVolumeFillWidth] = useState<number>(0);
  const [seekerFillWidth, setSeekerFillWidth] = useState<number>(0);
  const [showControls, setShowControls] = useState(showOnStart);
  const [volumePosition, setVolumePositionState] = useState(0);
  const [seekerPosition, setSeekerPositionState] = useState(0);
  const [volumeOffset, setVolumeOffset] = useState(0);
  const [seekerOffset, setSeekerOffset] = useState(0);
  const [seekerWidth, setSeekerWidth] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState(false);
  const [duration, setDuration] = useState(0);
  const [channelList, setChannelList] = useState(false);

  const navigation = useNavigation();

  const videoRef = props.videoRef || _videoRef;

  const toggleFullscreen = () => setIsFullscreen((prevState) => !prevState);
  const toggleControls = () =>
    setShowControls((prevState) => alwaysShowControls || !prevState);
  const toggleTimer = () => setShowTimeRemaining((prevState) => !prevState);
  const togglePlayPause = () => {
    setPaused((prevState) => !prevState);
  };

  const styles = {
    videoStyle,
    containerStyle: containerStyle,
  };

  const _onSeek = (obj) => {
    console.log("VideoPlayer onSeek: ", obj);

    if (!seeking) {
      setControlTimeout();
    }

    setLoading(false);

    setCurrentTime(obj.seekTime);
    setDuration(obj.duration);

    if (typeof onSeek === 'function') {
      onSeek(obj);
    }
  };

  const _onEnd = () => {
    if (currentTime < duration) {
      setCurrentTime(duration);
      setPaused(!props.repeat);

      if (showOnEnd) {
        setShowControls(!props.repeat);
      }
    }

    if (typeof onEnd === 'function') {
      onEnd();
    }
  };

  const _onError = (error) => {
    console.error("VideoPlayer Error: ", error);

    setError(true);
    setLoading(false);
  };

  function _onLoadStart(e) {
    console.log("VideoPlayer onLoadStart: ", e);

    setLoading(true);

    if (typeof onLoadStart === 'function') {
      onLoadStart();
    }
  }

  function _onLoad(data) {
    console.log("VideoPlayer onLoad: ", data);

    setDuration(data.duration);
    setLoading(false);

    if (showControls) {
      setControlTimeout();
    }

    if (typeof onLoad === 'function') {
      onLoad(data);
    }
  }

  function _onProgress(data) {
    console.log("VideoPlayer onProgress: ", data);

    if (!seeking) {
      setCurrentTime(data.currentTime);

      if (typeof onProgress === 'function') {
        onProgress(data);
      }
    }
  }

  function _onMetadata(data) {
    console.log("VideoPlayer onMetadata: ", data);
  }

  function _onSnapshot(data) {
    console.log("VideoPlayer onSnapshot: ", data);
  }

  function _onBuffer(data) {
    console.log("VideoPlayer onBuffer: ", data);
    setLoading(data.isBuffering);
  }

  const _onScreenTouch = () => {
    if (tapActionTimeout.current) {
      clearTimeout(tapActionTimeout.current);
      tapActionTimeout.current = null;
      toggleFullscreen();
      if (showControls) {
        resetControlTimeout();
      }
    } else {
      tapActionTimeout.current = setTimeout(() => {
        if (tapAnywhereToPause && showControls) {
          togglePlayPause();
          resetControlTimeout();
        } else {
          toggleControls();
        }
        tapActionTimeout.current = null;
      }, doubleTapTime);
    }
  };

  const events = {
    onError: onError || _onError,
    onBack: (onBack || _onBack(navigator)) as () => void,
    onEnd: _onEnd,
    onScreenTouch: _onScreenTouch,
    onEnterFullscreen,
    onExitFullscreen,
    onShowControls,
    onHideControls,
    onLoadStart: _onLoadStart,
    onSeek: _onSeek,
    onProgress: _onProgress,
    onLoad: _onLoad,
    onMetadata: _onMetadata,
    onSnapshot: _onSnapshot,
    onBuffer: _onBuffer,
    onPause,
    onPlay,
  };

  const constrainToSeekerMinMax = useCallback(
    (val = 0) => {
      if (val <= 0) {
        return 0;
      } else if (val >= seekerWidth) {
        return seekerWidth;
      }
      return val;
    },
    [seekerWidth],
  );

  const constrainToVolumeMinMax = (val = 0) => {
    if (val <= 0) {
      return 0;
    } else if (val >= volumeWidth + 9) {
      return volumeWidth + 9;
    }
    return val;
  };

  const setSeekerPosition = useCallback(
    (position = 0) => {
      const positionValue = constrainToSeekerMinMax(position);
      setSeekerPositionState(positionValue);
      setSeekerOffset(positionValue);
      setSeekerFillWidth(positionValue);
    },
    [constrainToSeekerMinMax],
  );

  const setVolumePosition = (position = 0) => {
    const positionValue = constrainToVolumeMinMax(position);
    setVolumePositionState(positionValue + iconOffset);

    if (positionValue < 0) {
      setVolumeFillWidth(0);
    } else {
      setVolumeFillWidth(positionValue);
    }
  };

  const { clearControlTimeout, resetControlTimeout, setControlTimeout } =
    useControlTimeout({
      controlTimeout,
      controlTimeoutDelay,
      mounted: mounted.current,
      showControls,
      setShowControls,
      alwaysShowControls,
    });

  const { volumePanResponder, seekPanResponder } = usePanResponders({
    duration,
    seekerOffset,
    volumeOffset,
    loading,
    seekerWidth,
    seeking,
    seekerPosition,
    seek: videoRef?.current?.seek,
    clearControlTimeout,
    setVolumePosition,
    setSeekerPosition,
    setSeeking,
    setControlTimeout,
    onEnd: events.onEnd,
    horizontal: horizontalPan,
    inverted: invertedPan,
  });

  useEffect(() => {
    if (currentTime >= duration) {
      videoRef?.current?.seek(0);
    }
  }, [currentTime, duration, videoRef]);

  useEffect(() => {
    if (toggleResizeModeOnFullscreen) {
      setResizeMode(_isFullscreen ? 'cover' : 'contain');
    }

    if (_isFullscreen) {
      typeof events.onEnterFullscreen === 'function' &&
        events.onEnterFullscreen();
    } else {
      typeof events.onExitFullscreen === 'function' &&
        events.onExitFullscreen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_isFullscreen, toggleResizeModeOnFullscreen]);

  useEffect(() => {
    setIsFullscreen(isFullscreen);
  }, [isFullscreen]);

  useEffect(() => {
    setPaused(paused);
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, [paused]);

  useEffect(() => {
    if (_paused) {
      typeof events.onPause === 'function' && events.onPause();
    } else {
      typeof events.onPlay === 'function' && events.onPlay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_paused]);

  useEffect(() => {
    if (!seeking && currentTime && duration) {
      const percent = currentTime / duration;
      const position = seekerWidth * percent;

      setSeekerPosition(position);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, duration, seekerWidth, setSeekerPosition]);

  useEffect(() => {
    if (showControls && !loading) {
      animations.showControlAnimation();
      setControlTimeout();
      typeof events.onShowControls === 'function' && events.onShowControls();
    } else {
      animations.hideControlAnimation();
      clearControlTimeout();
      typeof events.onHideControls === 'function' && events.onHideControls();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showControls, loading]);

  useEffect(() => {
    setMuted(muted);
  }, [muted]);

  useEffect(() => {
    const newVolume = volumePosition / volumeWidth;

    if (newVolume <= 0) {
      setMuted(true);
    } else {
      setMuted(false);
    }

    setVolume(newVolume);
    setVolumeOffset(volumePosition);

    const newVolumeTrackWidth = volumeWidth - volumeFillWidth;

    if (newVolumeTrackWidth > 150) {
      setVolumeTrackWidth(150);
    } else {
      setVolumeTrackWidth(newVolumeTrackWidth);
    }
  }, [volumeFillWidth, volumePosition]);

  useEffect(() => {
    console.log("VideoPlayer useEffect source: ", _resizeMode, _isFullscreen);
  }, [_resizeMode, _isFullscreen]);

  useEffect(() => {
    const position = volumeWidth * _volume;
    setVolumePosition(position);
    setVolumeOffset(position);
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearControlTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PlatformSupport
      showControls={showControls}
      containerStyles={styles.containerStyle}
      onScreenTouch={events.onScreenTouch}>
      <View style={[_styles.player.container, styles.containerStyle]}>
        <Video
          {...props}
          {...events}
          ref={videoRef || _videoRef}
          resizeMode={_resizeMode}
          videoAspectRatio={_isFullscreen ? "20:9" : '16:9'}
          volume={_volume * 100}
          paused={_paused}
          muted={_muted}
          rate={rate}
          style={[_styles.player.video, styles.videoStyle]}
          source={source}
        />
        {loading ? (
          <Loader />
        ) : (
          <>
            <Error error={error} />
            {!disableOverlay && <Overlay animations={animations} />}
            <TopControls
              panHandlers={volumePanResponder.panHandlers}
              animations={animations}
              disableBack={disableBack}
              disableVolume={disableVolume}
              volumeFillWidth={volumeFillWidth}
              volumeTrackWidth={volumeTrackWidth}
              volumePosition={volumePosition}
              onBack={events.onBack}
              resetControlTimeout={resetControlTimeout}
              showControls={showControls}
              setChannelList={setChannelList}
            />
            <PlayPause
              animations={animations}
              disablePlayPause={disablePlayPause}
              disableSeekButtons={duration == 0 || disableSeekButtons}
              paused={_paused}
              togglePlayPause={togglePlayPause}
              resetControlTimeout={resetControlTimeout}
              showControls={showControls}
              onPressRewind={() => {
                videoRef?.current?.seek(currentTime - rewindTime)
              }}
              onPressForward={() =>
                videoRef?.current?.seek(currentTime + rewindTime)
              }
            />
            <BottomControls
              animations={animations}
              panHandlers={seekPanResponder.panHandlers}
              disableTimer={duration == 0 || disableTimer}
              disableSeekbar={duration == 0 || disableSeekbar}
              showHours={showHours}
              showDuration={showDuration}
              paused={_paused}
              showTimeRemaining={_showTimeRemaining}
              currentTime={currentTime}
              duration={duration}
              seekColor={seekColor}
              title={title}
              toggleTimer={toggleTimer}
              resetControlTimeout={resetControlTimeout}
              seekerFillWidth={seekerFillWidth}
              seekerPosition={seekerPosition}
              setSeekerWidth={setSeekerWidth}
              isFullscreen={isFullscreen}
              disableFullscreen={disableFullscreen}
              toggleFullscreen={toggleFullscreen}
              showControls={showControls}
            />
            {(showControls && channelList) && (
              <animations.AnimatedView
                style={[
                  _styles.player.channelList,
                  animations.controlsOpacity,
                  animations.bottomControl,
                ]}>
                <View style={_styles.player.channelListContainer}>
                  <Text style={_styles.player.channelListTitle}>
                    Channel List
                  </Text>

                  <ScrollView style={_styles.player.channelListRow}>
                    {otherChannelList.map((channel, index) => (
                      <TouchableOpacity key={index} onPress={() => {
                        navigation.navigate('Video', {
                          item: {
                            name: channel.name,
                            url: streamUrlBuilder(channel),
                          },
                          otherChannelList: otherChannelList,
                        });
                      }}>
                        <View style={_styles.player.channel}>
                          <View style={_styles.player.channelIcon}>
                            <FastImage
                              style={_styles.player.channelIconImage}
                              source={{
                                uri: channel.stream_icon,
                                priority: FastImage.priority.normal,
                              }}
                              resizeMode={FastImage.resizeMode.contain}
                            />
                          </View>
                          <View style={_styles.player.channelInfo}>
                            <Text style={_styles.player.channelName}>{channel.name}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>))}
                  </ScrollView>
                </View>
              </animations.AnimatedView>
            )}
          </>
        )}
      </View>
    </PlatformSupport>
  );
};

const CustomAnimations = ({
  useAnimations,
  controlAnimationTiming = 450,
  ...props
}: WithRequiredProperty<VideoPlayerProps, 'useAnimations'>) => {
  const animations = useAnimations(controlAnimationTiming);
  return <AnimatedVideoPlayer animations={animations} {...props} />;
};

const JSAnimations = (props: VideoPlayerProps) => {
  const animations = useJSAnimations(props.controlAnimationTiming);

  return <AnimatedVideoPlayer animations={animations} {...props} />;
};

export const VideoPlayer = (props: Omit<VideoPlayerProps, 'animations'>) => {
  if (props?.useAnimations) {
    return <CustomAnimations useAnimations={props?.useAnimations} {...props} />;
  }

  return <JSAnimations {...props} />;
};
