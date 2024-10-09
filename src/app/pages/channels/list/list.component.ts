import { AlertController, IonInfiniteScroll, PopoverController } from '@ionic/angular';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { ActivatedRoute, Router } from '@angular/router';
import { Channel } from './../../../models/Channel';
import { ToastService } from './../../../services/toast.service';
import { ChannelService } from './../../../services/channel.service';
import { Component, OnInit, ViewChild } from '@angular/core';
import { User } from 'src/app/models/User';
import * as _ from 'lodash';
import { ChannelPopoverComponent } from '../list/ChannelPopoverComponent';

@Component({
  selector: 'app-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss'],
})
export class ListComponent implements OnInit {
  @ViewChild('infinitScroll') infinitScroll: IonInfiniteScroll;
  explorationLevel: 'city' | 'country' | 'global' = 'city';


  user: User | undefined;
  pageLoading = false;
  page: number = 0;
  channels: Channel[] = [];
  searchWord = "";
  type: string = '';
  followLoading: string[] = [];
  searchTimeout: any; // Add this line to declare the searchTimeout variable


  constructor(
    private channelService: ChannelService,
    private toastService: ToastService,
    private router: Router,
    private route: ActivatedRoute,
    private nativeStorage: NativeStorage,
    private alertCtrl: AlertController,
    private popoverController: PopoverController
  ) {}

  ngOnInit() {
    // Only load user data and channels if they haven't been loaded yet
    if (!this.user) {
        this.loadUserData(); 
    }
}

ionViewWillEnter() {
  // Fetch channels only if they haven't been loaded yet
  if (!this.channels.length) {
      this.page = 0;
      this.getType();
  }
}


  

  getType() {
    this.route.paramMap.subscribe(params => {
      this.type = params.get('type') || '';
      if (this.type === 'explore' || this.type === 'mines') {
        this.loadUserData();
      } else {
        this.getChannels(null, true);
      }
    });
  }

  loadUserData() {
    if (window.cordova) {
      this.nativeStorage.getItem('user')
        .then(
          user => {
            if (user) {
              this.user = new User().initialize(user);
              this.getChannels(null, true);
            } else {
              this.loadUserDataFromLocalStorage();
            }
          },
          error => {
            this.loadUserDataFromLocalStorage();
          }
        );
    } else {
      this.loadUserDataFromLocalStorage();
    }
  }

  loadUserDataFromLocalStorage() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      this.user = new User().initialize(user);
      this.getChannels(null, true);
    }
  }

  search(searchWord: string) {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  
    this.searchTimeout = setTimeout(() => {
      this.searchWord = searchWord;
      this.getChannels();
    }, 300); // Wait for 300ms after the last keystroke before making the API call
  }
  
  deleteChannel(channel: Channel, event: Event) {
    event.stopPropagation(); // Prevent click event from propagating to the parent
  
    // Add your logic for deleting the channel here
    this.channelService.deleteChannel(channel.id).then(
      (resp: any) => {
        this.toastService.presentStdToastr('Channel deleted successfully');
        this.channels = this.channels.filter(ch => ch.id !== channel.id);
      },
      err => {
        this.toastService.presentStdToastr('Failed to delete the channel');
      }
    );
  }
  
  async presentPopover(ev: any, channel: any) {
    const popover = await this.popoverController.create({
      component: ChannelPopoverComponent,  // This will be the popover component
      componentProps: { channel },  // Pass the channel data to the popover
      event: ev,
      translucent: true
    });
    return await popover.present();
  }

  handleResponse(resp: any, level: 'city' | 'country' | 'global') {
    this.pageLoading = false; // Ensure loading state is reset
  
    if (resp && resp.data) {
      console.log("response:", resp);
      console.log("resp.data:", resp.data);
  
      if (Array.isArray(resp.data.channels) && resp.data.channels.length > 0) {
        const initializedChannels = resp.data.channels.map(channelData => {
          // Update existing channel if it exists in this.channels
          const existingChannel = this.channels.find(c => c.id === channelData.id);
          if (existingChannel) {
            return Object.assign(existingChannel, Channel.createFromData(channelData));
          } else {
            return Channel.createFromData(channelData);
          }
        });
  
        if (this.page === 1) {
          // Initialize channels list with the first page data
          this.channels = _.uniqBy(initializedChannels, 'id');
        } else {
          // Concatenate and deduplicate channels
          this.channels = _.uniqBy(this.channels.concat(initializedChannels), 'id');
        }
  
        console.log('Channels after deduplication:', this.channels);
        console.log('Number of channels:', this.channels.length);
  
        // Disable infinite scroll if there are no more pages
        if (!resp.data.more) {
          this.infinitScroll.disabled = true;
        }
  
      } else {
        // Only show prompts if in 'explore' type, not in 'my channels'
        if (this.type === 'explore') {
          // No channels found, handle prompts for other exploration levels
          if (level === 'city') {
            // Prompt to explore country level if no channels found in city
            this.promptExploreOptions('country');
          } else if (level === 'country') {
            // Prompt to explore global level if no channels found in country
            this.promptExploreOptions('global');
          } else if (level === 'global') {
            // No channels found globally, prompt user to create their own channel
            this.promptCreateChannel(); // Global level reached, only prompt to create a channel
          }
        } else {
          // No channels and no further prompts, stop loading
          this.infinitScroll.disabled = true;
        }
      }
    } else {
      this.toastService.presentStdToastr('Failed to load channels');
    }
  }
  
  getTypechannel(channel: Channel): string | undefined {
    return channel.type;
  }
  
  
  
  promptCreateChannel() {
    this.alertCtrl.create({
      header: 'No Channels Found',
      message: 'No channels were found. Would you like to create your own channel?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Create Channel',
          handler: () => {
            this.router.navigate(['/tabs/channels/form']); // Updated path to match your route configuration
          }
        }
      ]
    }).then(alert => alert.present());
  }
  
  
  
  async promptExploreOptions(level: 'country' | 'global') {
    let header = '';
    let message = '';
  
    if (level === 'country') {
      header = 'No Channels Found in Your City';
      message = 'Would you like to explore channels in your country, or create your own channel?';
    } else if (level === 'global') {
      header = 'No Channels Found in Your Country';
      message = 'Would you like to explore channels around the world, or create your own channel?';
    }
  
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: level === 'country' ? 'Explore Country' : 'Explore Global',
          handler: () => {
            this.page = 0;
            console.log(`Page reset to: ${this.page} for ${level} level`);
  
            this.explorationLevel = level;
            this.exploreChannels(this.explorationLevel); // Trigger exploration at the next level
          }
        },
        {
          text: 'Create Channel',
          handler: () => {
            this.router.navigate(['/tabs/channels/form']); // Navigate to the create channel page
          }
        }
      ]
    });
    await alert.present();
  }

  
  handleError(err) {
    this.pageLoading = false;
    this.toastService.presentStdToastr(err);
  }


  getExploreTitle() {
    if (this.explorationLevel === 'city') {
      return `Explore channels (${this.user ? this.user.city : ''})`;
    } else if (this.explorationLevel === 'country') {
      return `Explore channels (${this.user ? this.user.country : ''})`;
    } else {
      return `Explore channels (Global)`;
    }
  }

  getChannels(event?: any, refresh?: boolean) {
    if (!this.user) return;

    console.log(`Current page: ${this.page}`);  // Log the current page

    this.pageLoading = true;
    if (refresh) {
        // Reset page only if refresh is true, to avoid redundant resets
        this.page = 0;
        console.log(`Page reset to: ${this.page}`);  // Log after resetting the page

        // Only clear channels array if refreshing for non-explore types
        if (this.type !== 'explore') {
            this.channels = [];  // Clear the existing channels array
        }
    }

    if (this.type === 'mines') {
        this.channelService.myChannels(this.page++, this.searchWord)
            .then(
                (resp: any) => this.handleResponse(resp, 'city'),
                err => this.handleError(err)
            );

    } else if (this.type === 'followed') {
        this.channelService.followedChannels(this.page++, this.searchWord)
            .then(
                (resp: any) => {
                    this.handleResponse(resp, 'city');
                    this.sortStaticChannels();  // Ensure static channels are sorted
                },
                err => this.handleError(err)
            );

    } else if (this.type === 'explore') {
        // Avoid making redundant calls to exploreChannels if the page isn't 0
        if (this.page === 0) {
            this.exploreChannels(this.explorationLevel);
        }
    }
}


sortStaticChannels() {
  this.channels = this.channels.sort((a, b) => {
    const staticTypes = ['static', 'static_events', 'static_dating'];

    if (staticTypes.includes(a.type) && !staticTypes.includes(b.type)) {
      return -1;
    } else if (!staticTypes.includes(a.type) && staticTypes.includes(b.type)) {
      return 1;
    }
    return 0;
  });
}

  

  async promptExploreCountry() {
    const alert = await this.alertCtrl.create({
      header: 'No Channels Found',
      message: 'No channels were found in your city. Would you like to explore channels in your country?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Explore Country',
          handler: () => {
            this.page = 0;  
            console.log(`Page reset to: ${this.page} for country level`);  // Log the page reset for country

            this.explorationLevel = 'country';  
            this.exploreChannels(this.explorationLevel);  
          }
        }
      ]
    });
    await alert.present();
  }
  

  async promptExploreGlobal() {
    const alert = await this.alertCtrl.create({
      header: 'No Channels Found',
      message: 'No channels were found in your country. Would you like to explore channels around the world?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Explore Global',
          handler: () => {
            this.page = 0;  // Reset the page number for a new search
            console.log(`Page reset to: ${this.page} for global level`);  // Log the page reset for global

            this.explorationLevel = 'global';  // Update exploration level to 'global'
            this.exploreChannels(this.explorationLevel);  // Trigger exploration at the global level
          }
        }
      ]
    });
    await alert.present();
  }

  exploreChannels(level: 'city' | 'country' | 'global' = 'city') {
    console.log(`exploreChannels API called ${level} level`);

    // Reset channels array when switching exploration levels
    if (this.explorationLevel !== level) {
        this.channels = [];
    }

    // Ensure API call is only made when the page is 0
    if (this.page === 0) {
        this.explorationLevel = level;
        this.channelService.exploreChannels(this.page++, this.searchWord, level)
            .then(
                (resp: any) => {
                    console.log('Response from exploreChannels API:', resp);
                    console.log(`Current page after API call: ${this.page}`);

                    if (resp.data && resp.data.channels) {
                        const initializedChannels = resp.data.channels.map(channelData => {
                            return Channel.createFromData(channelData);
                        });

                        // Handle response and deduplication as usual
                        this.handleResponse({ data: { channels: initializedChannels } }, level);
                    }
                },
                err => this.handleError(err)
            );
    }
}

  

  follow(channel: Channel) {
    if (!this.user) return;

    this.followLoading.push(channel.id);
    this.channelService.follow(channel.id)
      .then(
        (resp: any) => {
          this.followLoading.splice(this.followLoading.indexOf(channel.id), 1);
          this.toastService.presentStdToastr(resp.message);
          if (resp.data)
            channel.followers.push(this.user.id);
          else
            channel.followers.splice(channel.followers.indexOf(this.user.id), 1);
        },
        err => {
          this.followLoading.splice(this.followLoading.indexOf(channel.id), 1);
          this.toastService.presentStdToastr(err);
        }
      );
  }

  showChannel(channel: Channel) {
    this.router.navigate(['/tabs/channels/channel'], {
      queryParams: {
        channel: JSON.stringify(channel.toObject())
      }
    });
  }
}
