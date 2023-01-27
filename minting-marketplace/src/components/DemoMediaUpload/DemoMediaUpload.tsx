import React, { useCallback, useEffect, useState } from 'react';
import Dropzone from 'react-dropzone';
import { useSelector } from 'react-redux';
import axios from 'axios';
import io from 'socket.io-client';

import WorkflowContext from '../../contexts/CreatorWorkflowContext';
import { RootState } from '../../ducks';
import { ColorStoreType } from '../../ducks/colors/colorStore.types';
import { ContractsInitialType } from '../../ducks/contracts/contracts.types';
import videoIcon from '../../images/videoIcon.svg';
import { rFetch } from '../../utils/rFetch';
import { OptionsType } from '../common/commonTypes/InputSelectTypes.types';
import { IMediaUpload, TMediaType } from '../creatorStudio/creatorStudio.types';

import MediaListBox from './MediaListBox/MediaListBox';
import UploadedListBox from './UploadedListBox/UploadedListBox';

import './DemoMediaUpload.css';

const MediaUpload: React.FC<IMediaUpload> = ({ contractData }) => {
  const { primaryColor, textColor } = useSelector<RootState, ColorStoreType>(
    (store) => store.colorStore
  );
  const { currentUserAddress } = useSelector<RootState, ContractsInitialType>(
    (store) => store.contractStore
  );

  const selectCommonInfo = {
    customClass: 'form-control rounded-rair',
    customCSS: {
      backgroundColor: `var(--${primaryColor}-80)`,
      color: textColor
    },
    optionCSS: {
      color: textColor
    }
  };

  const [mediaList, setMediaList] = useState<TMediaType[]>([]);
  const [mediaUploadedList, setMediaUploadedList] = useState<any>([]);
  const [categories, setCategories] = useState<OptionsType[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [rerender, setRerender] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean | null>(null);
  const [thisSessionId, setThisSessionId] = useState<string>('');
  const [socketMessage, setSocketMessage] = useState<string | undefined>();
  const [uploadProgress, setUploadProgress] = useState<
    boolean | number | undefined
  >(undefined);
  const [currentTitleVideo, setCurrentTitleVideo] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<
    string | undefined
  >();

  const rerenderFC = () => {
    setRerender(!rerender);
  };

  useEffect(() => {
    const sessionId = Math.random().toString(36).substr(2, 9);
    setThisSessionId(sessionId);
    const so = io(`http://localhost:5002`, { transports: ['websocket'] });
    so.emit('init', sessionId);
    so.on('uploadProgress', (data) => {
      const { last, message } = data;
      setSocketMessage(message);
      if (message) {
        setUploadProgress(StringToNumber(message));
      }
      if (last) {
        setUploading(false);
        setUploadSuccess(true);
        getMediaList();
      }
    });

    return () => {
      so.removeListener('uploadProgress');
      so.emit('end', sessionId);
    };
    //eslint-disable-next-line
  }, []);

  const getCategories = async () => {
    const newCategories = [
      {
        name: 'Unlocked (demo)',
        disabled: false
      },
      {
        name: `NFT🔒 (coming soon)`,
        disabled: true
      }
    ];
    setCategories(
      newCategories.map((item) => {
        return { label: item.name, value: item.name, disabled: item.disabled };
      })
    );
    const { success, categories } = await rFetch(`/api/categories`);

    if (success) {
      setSelectedCategory(categories[0].name);
    }
  };

  const getMediaList = async () => {
    if (currentUserAddress !== undefined) {
      const { success, list } = await rFetch(
        `/api/media/list?blockchain=0x1&contractAddress=0x571acc173f57c095f1f63b28f823f0f33128a6c4&userAddress=${currentUserAddress}`
      );

      if (success) setMediaUploadedList(list);
    }
  };

  useEffect(() => {
    getCategories();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (uploadSuccess) {
      getMediaList();
      setUploading(false);
      setUploadProgress(false);
    }
  }, [uploadSuccess]);

  useEffect(() => {
    if (!currentUserAddress) return;
    getMediaList();
    // eslint-disable-next-line
  }, [currentUserAddress]);

  const uploadVideoDemo = async (item) => {
    setCurrentTitleVideo(item.title);
    setUploadSuccess(false);
    const formData = new FormData();
    formData.append('video', item.file);
    formData.append('title', item.title.slice(0, 29));
    formData.append('description', item.description);
    if (selectedCategory) {
      formData.append('category', selectedCategory);
    }
    formData.append('demo', String(item.offer === '-1'));
    setUploading(true);
    try {
      const request = await rFetch(
        `/ms/api/v1/media/upload/demo?socketSessionId=${thisSessionId}`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json'
          },
          body: formData
        }
      );

      if (request && request.status === 'faild') {
        setUploading(false);
        setUploadProgress(false);
        setUploadSuccess(null);
      }

      setUploading(false);
      getMediaList();
    } catch (e) {
      console.error(e);
      setUploading(false);
    }
  };

  const StringToNumber = useCallback((message) => {
    const str = message.substr(message.length - 8, 10);
    const lastString = message.split(' pin');
    const lastString2 = message.split(' upload');
    if (lastString2[1] === 'ing to Google Cloud') {
      setSocketMessage('uploaing to Google Cloud');
    }
    const specSymb = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.'];
    const newStr = str.split('').filter((item) => {
      if (specSymb.includes(item)) {
        return item;
      }
    });
    if (isNaN(newStr.join(''))) {
      if (message === 'uploaded to Google Cloud.') {
        setUploadSuccess(true);
        getMediaList();
        setUploadProgress(false);
        setUploadSuccess(null);
        setSocketMessage('');
      } else if (lastString[1] === 'ning to Google Cloud.') {
        setMediaList((prev) => [
          ...prev.filter((item) => item.file.name !== lastString[0])
        ]);
        setUploading(false);
        setCurrentTitleVideo('');
        setSocketMessage('');
      }
      return false;
    } else {
      return Number(newStr.join(''));
    }
  }, []);

  const onMediaDrop = (media) => {
    let aux: TMediaType[] = [...mediaList];
    aux = aux.concat(
      media.map((item: File) => {
        return {
          offer: 'null',
          category: 'DEMO',
          title: item.name.slice(0, 29),
          file: item,
          description: 'test',
          preview: URL.createObjectURL(item),
          contractAddress: contractData?._id,
          productIndex: contractData?.product.collectionIndexInContract,
          storage: 'null'
        };
      })
    );
    setMediaList(aux);
  };

  const deleterUploaded = async (index: number) => {
    try {
      await axios
        .delete(`/api/media/remove/${index}`, {
          headers: {
            'Content-Type': 'application/json',
            'x-rair-token': localStorage.token
          }
        })
        .then((res) => {
          getMediaList();
        });
    } catch (e) {
      console.info(e);
    }
  };

  const deleter = async (index: number) => {
    const aux = [...mediaList];
    aux.splice(index, 1);
    setMediaList(aux);
  };

  const copyEmbebed = (videoId) => {
    const iframe = `
      <iframe id="${videoId}" src="${process.env.REACT_APP_SERVER_URL}/watch/0x571acc173f57c095f1f63b28f823f0f33128a6c4/${videoId}/stream.m3u8" width="800px" height="800px"></iframe>
    `;
    navigator.clipboard.writeText(iframe);
  };

  const updateMediaCategory = (array, index, value: string) => {
    array[index].category = value;
    setMediaList(array);
    rerenderFC();
  };

  return (
    <div className="demo-media-wrapper">
      <h3 className="fw-bold">Video demo</h3>
      <h6 className="m-auto col-5" style={{ color: '#A7A6A6' }}>
        Max file size 500 mb each. Please add your email profile settings.
        Analytics will be emailed to you weekly
      </h6>
      <br />
      <div className="m-auto col-10 mb-5">
        <div className="rounded-rair col-12 mb-3">
          <Dropzone onDrop={onMediaDrop}>
            {({ getRootProps, getInputProps, isDragActive }) => (
              <section>
                <div
                  {...getRootProps()}
                  style={{
                    border: 'dashed 1px var(--charcoal-80)',
                    position: 'relative'
                  }}
                  className="w-100 h-100 rounded-rair col-6 text-center mb-3 p-5">
                  <input {...getInputProps()} />
                  <img
                    alt=""
                    style={{
                      filter:
                        primaryColor === 'rhyno' ? 'brightness(40%)' : undefined
                    }}
                    src={videoIcon}
                    className="mt-5 mb-3"
                  />
                  <br />
                  {isDragActive ? (
                    <>Drop the images here ...</>
                  ) : (
                    <>
                      Drag and drop or{' '}
                      <span style={{ color: 'var(--bubblegum)' }}>click</span>{' '}
                      to upload unlockable content
                    </>
                  )}
                </div>
              </section>
            )}
          </Dropzone>
        </div>
        {Object.keys(mediaUploadedList).map((item, index) => {
          const fileData = mediaUploadedList[item];
          return (
            <UploadedListBox
              key={fileData.title + index}
              fileData={fileData}
              index={index}
              setMediaList={setMediaList}
              mediaList={mediaList}
              uploadSuccess={uploadSuccess}
              copyEmbebed={copyEmbebed}
              selectCommonInfo={selectCommonInfo}
              updateMediaCategory={updateMediaCategory}
              mediaUploadedList={mediaUploadedList}
              deleterUploaded={deleterUploaded}
              categories={categories}
            />
          );
        })}
        {mediaList.map((item, index, array) => {
          return (
            <MediaListBox
              key={index + item.title}
              item={item}
              index={index}
              mediaList={mediaList}
              setMediaList={setMediaList}
              uploadSuccess={uploadSuccess}
              uploadProgress={uploadProgress}
              uploading={uploading}
              uploadVideoDemo={uploadVideoDemo}
              categories={categories}
              selectCommonInfo={selectCommonInfo}
              deleter={deleter}
              updateMediaCategory={updateMediaCategory}
              currentTitleVideo={currentTitleVideo}
              socketMessage={socketMessage}
            />
          );
        })}
      </div>
    </div>
  );
};

const ContextWrapper = (props: IMediaUpload) => {
  return (
    <WorkflowContext.Consumer>
      {(value) => {
        return <MediaUpload {...value} {...props} />;
      }}
    </WorkflowContext.Consumer>
  );
};

export default ContextWrapper;
