import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
// @ts-ignore
import VideoPlayerVLC from "@lunarr/vlc-player";

import VideoPlayerRN from 'react-native-video';
// @ts-ignore
import { VolumeManager } from 'react-native-volume-manager';

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
    useVLC = false,
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
  const [audioTrackList, setAudioTrack] = useState(false);
  const [audios, setAudios] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState(0);
  const [height, setHeight] = useState(0);

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

    //setError(true);
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
      setLoading(false);
      if (data.currentTime < data.duration && data.duration > 0) {
        setCurrentTime(data.currentTime);
      }

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

  function _onVideoStateChange(data) {
    console.log("VideoPlayer onVideoStateChange: ", data);

    if (data.type == "mediaMetaDataDidChange") {
      setLoading(false);
    } else { }
  }

  function _onBuffer(data) {
    const videoInfo = data.videoInfo;
    if (videoInfo && "audioTracks" in videoInfo) {
      setAudios(videoInfo.audioTracks);
    }
    if (videoInfo && !("videoSize" in videoInfo)) {
      setLoading(true);
      return;
    }

    if (videoInfo && videoInfo.duration) {
      setDuration(videoInfo.duration / 1000);
      //setHeight(videoInfo.height);  
    }

    console.log("audios: ", audios);

    console.log("VideoPlayer onBuffer: ", data, JSON.stringify(data.videoInfo));

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
    onError: _onError,
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
    onVideoStateChange: _onVideoStateChange
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
    if (showControls) {
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
    // (async () => {
    //   const volume = await VolumeManager.getVolume();
    //   const position = volumeWidth * volume.volume;
    //   setVolumePosition(position);
    //   setVolumeOffset(position);

    //   console.log("VolumeManager.addVolumeListener: ", volume);
    // })();

    // VolumeManager.addVolumeListener((result) => {
    //   console.log("VolumeManager.addVolumeListener: ", result);

    //   const position = volumeWidth * result.volume;
    //   setVolumePosition(position);
    //   setVolumeOffset(position);
    // });

  }, []);

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
    /*videoRef?.current?.isPlaying((isPlaying) => {
      console.log("VideoPlayer isPlaying: ", isPlaying);
    });*/

  }, [_resizeMode, _isFullscreen]);

  useEffect(() => {
    const position = volumeWidth * _volume;
    setVolumePosition(position);
    setVolumeOffset(position);
    mounted.current = true;

    console.log("VideoPlayer useEffect: ", props);
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

        {useVLC && (
          <VideoPlayerVLC
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
          />)}

        {!useVLC && (
          <VideoPlayerRN
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
        )}

        {loading ? (
          <>
            <TopControls
              panHandlers={volumePanResponder.panHandlers}
              animations={animations}
              disableBack={disableBack}
              disableVolume={true}
              volumeFillWidth={volumeFillWidth}
              volumeTrackWidth={volumeTrackWidth}
              volumePosition={volumePosition}
              onBack={events.onBack}
              resetControlTimeout={resetControlTimeout}
              showControls={showControls}
              setChannelList={setChannelList}
              setAudioList={setAudioTrack}
              audios={audios}
              height={height}
            />
            <Loader />
          </>
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
              setAudioList={setAudioTrack}
              audios={audios}
              height={height}
            />
            <PlayPause
              animations={animations}
              disablePlayPause={duration == 0 || currentTime == 0 || disablePlayPause}
              disableSeekButtons={duration == 0 || currentTime == 0 || disableSeekButtons}
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
              disableTimer={duration == 0 || currentTime == 0 || disableTimer}
              disableSeekbar={duration == 0 || currentTime == 0 || disableSeekbar}
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
            {(showControls && !channelList && audioTrackList) && (
              <animations.AnimatedView
                style={[
                  _styles.player.channelList,
                  animations.controlsOpacity,
                  animations.bottomControl,
                ]}>
                <View style={_styles.player.channelListContainer}>
                  <ScrollView style={_styles.player.channelListRow}>
                    {audios.map((channel, index) => (
                      <TouchableOpacity key={index} onPress={() => {
                      }}>
                        <View style={_styles.player.channel}>
                          <View style={[_styles.player.channelInfo, { flex: 1 }]}>
                            <Text style={_styles.player.channelName}>{channel.name}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>))}
                  </ScrollView>
                </View>
              </animations.AnimatedView>
            )}
            {(showControls && channelList && !audioTrackList) && (
              <animations.AnimatedView
                style={[
                  _styles.player.channelList,
                  animations.controlsOpacity,
                  animations.bottomControl,
                ]}>
                <View style={_styles.player.channelListContainer}>
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
    </PlatformSupport >
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
